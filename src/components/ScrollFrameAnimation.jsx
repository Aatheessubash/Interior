import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import './ScrollFrameAnimation.css';

export const TOTAL_FRAMES = 221;
const FRAME_BASE = '/frames/frames';
const IMAGE_WIDTH = 1280;
const IMAGE_HEIGHT = 720;

// Windowed preloading: only keep this many frames in memory around the current
// scroll position. Distant frames are evicted to prevent ~800 MB memory bloat.
const BUFFER_AHEAD = 35;
const BUFFER_BEHIND = 20;
const EVICT_DISTANCE = 55;

// Decoded-frame status codes.
const PENDING = 0;
const READY = 1;
const FAILED = 2;
const LOADING = 3;

function getFrameUrl(index) {
  return `${FRAME_BASE}${String(index + 1).padStart(5, '0')}.webp`;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Adaptive decode concurrency: keep the main thread/network responsive on
// low-core / low-memory / small-screen devices.
function pickConcurrency() {
  const cores =
    (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const memory =
    (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;

  let concurrency = cores >= 8 ? 6 : 4;
  if (memory <= 4) concurrency = Math.min(concurrency, 3);
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches
  ) {
    concurrency = Math.min(concurrency, 4);
  }
  return concurrency;
}

// Ordered list of frame indices to decode: current frame first, then outward in
// the direction of scrolling, then the opposite direction. Covers the whole
// sequence over time while always prioritising what the user is about to see.
function buildQueue(center, dir, limit) {
  const queue = [];
  for (let d = 0; d < limit; d++) {
    if (dir >= 0) {
      const forward = center + d;
      if (forward >= 0 && forward < limit) queue.push(forward);
      if (d > 0) {
        const backward = center - d;
        if (backward >= 0 && backward < limit) queue.push(backward);
      }
    } else {
      const backward = center - d;
      if (backward >= 0 && backward < limit) queue.push(backward);
      if (d > 0) {
        const forward = center + d;
        if (forward >= 0 && forward < limit) queue.push(forward);
      }
    }
  }
  return queue;
}

const ScrollFrameAnimation = forwardRef(function ScrollFrameAnimation(
  { className = '', reducedMotion = false, onFirstFrameReady },
  ref
) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const imagesRef = useRef([]);
  const statusRef = useRef(new Uint8Array(TOTAL_FRAMES));

  const drawnRef = useRef(-1);
  const desiredRef = useRef(0);
  // Eased playhead that glides toward desiredRef every rAF, so frames never
  // snap even when scroll position jumps.
  const smoothRef = useRef(0);
  const dirRef = useRef(1);
  const drawRef = useRef(null);
  const pumpRef = useRef(null);
  const rafRef = useRef(null);

  // Cached layout coordinates — eliminates per-frame getBoundingClientRect reflows.
  const dimRef = useRef({ w: 0, h: 0 });
  const imageSizeRef = useRef({ w: IMAGE_WIDTH, h: IMAGE_HEIGHT });
  const cropRef = useRef({ sx: 0, sy: 0, sw: IMAGE_WIDTH, sh: IMAGE_HEIGHT });

  // Track whether the first-frame callback has fired.
  const firstFrameFiredRef = useRef(false);
  const onFirstFrameReadyRef = useRef(onFirstFrameReady);
  onFirstFrameReadyRef.current = onFirstFrameReady;

  // ── Find the closest already-decoded frame (keeps last valid frame visible) ──
  const resolveFrame = useCallback((target) => {
    const status = statusRef.current;
    if (status[target] === READY) return target;

    for (let d = 1; d < TOTAL_FRAMES; d++) {
      const left = target - d;
      if (left >= 0 && status[left] === READY) return left;
      const right = target + d;
      if (right < TOTAL_FRAMES && status[right] === READY) return right;
    }
    return -1;
  }, []);

  // ── Continuous rAF glide loop: eases the frame index toward the scroll ──
  // target each tick, coalescing any number of scroll updates into one draw
  // per compositor frame. Stops once the eased value has settled.
  const LERP = 0.22;
  const SNAP_EPSILON = 0.004;

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    const step = () => {
      const desired = desiredRef.current;
      const current = smoothRef.current;
      const diff = desired - current;

      if (Math.abs(diff) <= SNAP_EPSILON) {
        smoothRef.current = desired;
        rafRef.current = null;
        drawRef.current?.(desired);
        return;
      }

      smoothRef.current = current + diff * LERP;
      drawRef.current?.(smoothRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // ── Recompute canvas size + cover-fit crop only when the element changes ──
  const updateDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    const { w: iw, h: ih } = imageSizeRef.current;

    if (
      canvas.width === w &&
      canvas.height === h &&
      dimRef.current.iw === iw &&
      dimRef.current.ih === ih
    ) {
      return;
    }

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    dimRef.current = { w, h, iw, ih };
    const imageRatio = iw / ih;
    const canvasRatio = w / h;
    let sx, sy, sw, sh;

    if (imageRatio > canvasRatio) {
      sh = ih;
      sw = Math.round(ih * canvasRatio);
      sx = Math.round((iw - sw) * 0.5);
      sy = 0;
    } else {
      sw = iw;
      sh = Math.round(iw / canvasRatio);
      sx = 0;
      sy = Math.round((ih - sh) * 0.5);
    }

    cropRef.current = {
      sx: Math.max(0, sx),
      sy: Math.max(0, sy),
      sw: Math.max(1, Math.min(sw, iw)),
      sh: Math.max(1, Math.min(sh, ih)),
    };
    drawnRef.current = -1;
    scheduleDraw();
  }, [scheduleDraw]);

  // ── Cover-fit blit. Adjacent frames are crossfaded so the sequence glides. ──
  const draw = useCallback(
    (target) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { w, h } = dimRef.current;
      if (w === 0 || h === 0) {
        updateDimensions();
        return;
      }

      const maxIndex = TOTAL_FRAMES - 1;
      const exact = clamp(Number(target) || 0, 0, maxIndex);
      const lower = Math.min(maxIndex, Math.floor(exact));
      const upper = Math.min(maxIndex, lower + 1);
      let blend = exact - lower;

      const status = statusRef.current;
      const images = imagesRef.current;

      let from = lower;
      let to = upper;
      if (status[from] !== READY) {
        from = resolveFrame(lower);
        if (from < 0) return;
        to = from;
        blend = 0;
      } else if (to === from || status[to] !== READY || blend < 0.02) {
        to = from;
        blend = 0;
      }

      // Quantised stamp: skip redraw only when from/to/blend are unchanged.
      // 64 blend steps keep the crossfade visually continuous.
      const stamp =
        from +
        to * TOTAL_FRAMES +
        Math.round(blend * 64) * TOTAL_FRAMES * TOTAL_FRAMES;
      if (stamp === drawnRef.current) return;

      const baseImg = images[from];
      if (!baseImg) return;

      if (!ctxRef.current) {
        ctxRef.current = canvas.getContext('2d', { alpha: false });
        if (!ctxRef.current) return;
      }

      const ctx = ctxRef.current;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const { sx, sy, sw, sh } = cropRef.current;

      try {
        ctx.globalAlpha = 1;
        ctx.drawImage(baseImg, sx, sy, sw, sh, 0, 0, w, h);
        if (blend > 0 && images[to]) {
          ctx.globalAlpha = blend;
          ctx.drawImage(images[to], sx, sy, sw, sh, 0, 0, w, h);
          ctx.globalAlpha = 1;
        }
        drawnRef.current = stamp;
      } catch {
        ctx.globalAlpha = 1;
      }
    },
    [resolveFrame, updateDimensions]
  );

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // ── Scroll position → frame index. No React state, no layout reads. ──
  const setProgress = useCallback(
    (progress) => {
      const p = clamp(Number(progress) || 0, 0, 1);
      const target = p * (TOTAL_FRAMES - 1);

      if (target !== desiredRef.current) {
        dirRef.current = target > desiredRef.current ? 1 : -1;
        desiredRef.current = target;
      }

      scheduleDraw();
      pumpRef.current?.();
    },
    [scheduleDraw]
  );

  useImperativeHandle(ref, () => ({ setProgress }), [setProgress]);

  // ── Prioritised, direction-aware, non-blocking frame preloader ──
  useEffect(() => {
    const images = new Array(TOTAL_FRAMES).fill(null);
    const status = new Uint8Array(TOTAL_FRAMES);
    imagesRef.current = images;
    statusRef.current = status;
    drawnRef.current = -1;

    let disposed = false;
    let readyCount = 0;
    let active = 0;
    let queue = [];
    let queueCenter = -9999; // force an initial rebuild
    let queueDir = 1;

    const maxConcurrency = pickConcurrency();
    const preloadTotal = reducedMotion
      ? Math.min(TOTAL_FRAMES, 6)
      : TOTAL_FRAMES;

    const finish = (index, img, ok) => {
      if (status[index] === LOADING) active--;
      if (disposed) {
        status[index] = ok ? READY : FAILED;
        return;
      }

      if (ok && img && img.naturalWidth > 0) {
        status[index] = READY;
        readyCount++;

        // Notify the parent the very first time a frame becomes renderable.
        if (!firstFrameFiredRef.current) {
          firstFrameFiredRef.current = true;
          onFirstFrameReadyRef.current?.();
        }

        const size = imageSizeRef.current;
        if (size.w !== img.naturalWidth || size.h !== img.naturalHeight) {
          imageSizeRef.current = { w: img.naturalWidth, h: img.naturalHeight };
          drawnRef.current = -1;
          updateDimensions();
        }

        // Always re-check the canvas when a frame lands. The stamp dedupe in
        // draw() makes this cheap, and it upgrades a stuck fallback frame the
        // moment a closer one becomes available — otherwise the screen can
        // freeze mid-sequence until the next decode or scroll event.
        scheduleDraw();
      } else {
        status[index] = FAILED;
      }

      pump();
    };

    const startLoad = (index) => {
      if (disposed || status[index] !== PENDING) return;

      status[index] = LOADING;
      active++;

      const img = new Image();
      images[index] = img;
      img.decoding = 'async';
      if (index === 0) img.fetchPriority = 'high';

      let settled = false;
      const settle = (ok) => {
        if (settled) return;
        settled = true;
        finish(index, img, ok);
      };

      img.onload = () => settle(true);
      img.onerror = () => settle(false);
      img.src = getFrameUrl(index);

      if (img.decode) {
        img
          .decode()
          .then(() => settle(true))
          .catch(() => {
            // decode() can reject before the load completes; fall back to onload.
            if (img.complete) settle(img.naturalWidth > 0);
          });
      }
    };

    // Evict decoded frames that are far from the current scroll position to
    // cap browser memory at ~180 MB instead of ~800 MB.
    const evictDistant = (center) => {
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (status[i] !== READY) continue;
        const dist = Math.abs(i - center);
        if (dist > EVICT_DISTANCE) {
          const img = images[i];
          if (img) {
            img.onload = null;
            img.onerror = null;
            img.src = '';
            images[i] = null;
          }
          status[i] = PENDING;
        }
      }
    };

    const pump = () => {
      if (disposed) return;

      const center = clamp(Math.round(desiredRef.current), 0, preloadTotal - 1);
      const dir = dirRef.current;

      // Evict frames far from current view to free memory.
      evictDistant(center);

      // Compute the window of frames we want loaded.
      const lo = clamp(center - BUFFER_BEHIND, 0, preloadTotal - 1);
      const hi = clamp(center + BUFFER_AHEAD, 0, preloadTotal - 1);

      if (Math.abs(center - queueCenter) > 2 || dir !== queueDir) {
        // Build queue only for frames within our window.
        queue = buildQueue(center, dir, preloadTotal).filter(i => i >= lo && i <= hi);
        queueCenter = center;
        queueDir = dir;
      }

      while (active < maxConcurrency && queue.length) {
        const index = queue.shift();
        if (status[index] !== PENDING) continue;
        startLoad(index);
      }
    };

    pumpRef.current = pump;

    // Establish layout before the first decode lands.
    updateDimensions();
    pump();

    return () => {
      disposed = true;
      pumpRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img) {
          img.onload = null;
          img.onerror = null;
        }
      }
    };
  }, [reducedMotion, scheduleDraw, updateDimensions]);

  // ── Resize handling via ResizeObserver + rAF (no scroll-time layout reads) ──
  useEffect(() => {
    updateDimensions();

    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeRaf = null;
    const scheduleResize = () => {
      if (resizeRaf !== null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        updateDimensions();
      });
    };

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleResize) : null;
    observer?.observe(canvas);

    window.addEventListener('resize', scheduleResize, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
    };
  }, [updateDimensions]);

  return (
    <div
      className={`scroll-frame ${className}`}
      id="scroll-frame-container"
    >
      <canvas
        ref={canvasRef}
        className="scroll-frame__canvas"
        id="frame-canvas"
      />
    </div>
  );
});

export default ScrollFrameAnimation;
