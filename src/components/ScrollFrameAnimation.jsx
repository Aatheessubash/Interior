import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import './ScrollFrameAnimation.css';

const TOTAL_FRAMES = 180;
const FRAME_PATH = '/frames/frames';
const MOBILE_BREAKPOINT = 768;
const DESKTOP_BATCH_SIZE = 8;
const MOBILE_BATCH_SIZE = 4;
const DESKTOP_MAX_RENDER_WIDTH = 1440;
const MOBILE_MAX_RENDER_WIDTH = 960;

function getFrameUrl(index) {
  const padded = String(index).padStart(5, '0');
  return `${FRAME_PATH}${padded}.png`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isImageReady(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0);
}

function getMaxRenderWidth() {
  const viewportWidth = window.innerWidth || DESKTOP_MAX_RENDER_WIDTH;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  if (viewportWidth <= MOBILE_BREAKPOINT) {
    return Math.min(
      MOBILE_MAX_RENDER_WIDTH,
      Math.max(640, viewportWidth * pixelRatio)
    );
  }

  return Math.min(
    DESKTOP_MAX_RENDER_WIDTH,
    Math.max(960, viewportWidth * pixelRatio)
  );
}

const ScrollFrameAnimation = forwardRef(function ScrollFrameAnimation(
  { className = '', reducedMotion = false },
  ref
) {
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const targetProgressRef = useRef(0);
  const targetFrameRef = useRef(0);
  const drawnFrameRef = useRef(-1);
  const progressRafRef = useRef(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [firstFrameLoaded, setFirstFrameLoaded] = useState(false);

  const drawFrame = useCallback((image, frameIndex) => {
    const canvas = canvasRef.current;
    if (!canvas || !isImageReady(image)) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const maxRenderWidth = getMaxRenderWidth();
    const scale = Math.min(1, maxRenderWidth / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    drawnFrameRef.current = frameIndex;
  }, []);

  const findDrawableFrame = useCallback((targetIndex) => {
    const images = imagesRef.current;
    const exactImage = images[targetIndex];

    if (isImageReady(exactImage)) {
      return { image: exactImage, index: targetIndex };
    }

    const currentImage = images[drawnFrameRef.current];
    if (isImageReady(currentImage)) {
      return { image: currentImage, index: drawnFrameRef.current };
    }

    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      if (isImageReady(images[index])) {
        return { image: images[index], index };
      }
    }

    for (let index = targetIndex + 1; index < TOTAL_FRAMES; index += 1) {
      if (isImageReady(images[index])) {
        return { image: images[index], index };
      }
    }

    return null;
  }, []);

  const flushProgress = useCallback(() => {
    progressRafRef.current = null;
    const progress = clamp(targetProgressRef.current, 0, 1);
    const frameIndex = Math.round(progress * (TOTAL_FRAMES - 1));
    targetFrameRef.current = frameIndex;
    const drawableFrame = findDrawableFrame(frameIndex);

    if (!drawableFrame || drawnFrameRef.current === drawableFrame.index) return;
    drawFrame(drawableFrame.image, drawableFrame.index);
  }, [drawFrame, findDrawableFrame]);

  const setProgress = useCallback((progress) => {
    targetProgressRef.current = clamp(Number(progress) || 0, 0, 1);

    if (progressRafRef.current === null) {
      progressRafRef.current = requestAnimationFrame(flushProgress);
    }
  }, [flushProgress]);

  useImperativeHandle(ref, () => ({ setProgress }), [setProgress]);

  useEffect(() => {
    const images = new Array(TOTAL_FRAMES);
    let loaded = 0;
    let nextIndex = 1;
    let activeBatch = 0;
    let disposed = false;
    let idleCallback = null;
    let timeoutCallback = null;
    const batchSize =
      window.innerWidth <= MOBILE_BREAKPOINT
        ? MOBILE_BATCH_SIZE
        : DESKTOP_BATCH_SIZE;

    setLoadedCount(0);
    setFirstFrameLoaded(false);
    drawnFrameRef.current = -1;
    imagesRef.current = images;

    function scheduleNextBatch() {
      if (disposed || nextIndex >= TOTAL_FRAMES) return;

      if (typeof window.requestIdleCallback === 'function') {
        idleCallback = window.requestIdleCallback(
          () => {
            idleCallback = null;
            loadBatch();
          },
          { timeout: 200 }
        );
      } else {
        timeoutCallback = window.setTimeout(() => {
          timeoutCallback = null;
          loadBatch();
        }, 16);
      }
    }

    function loadImage(index) {
      if (disposed) return;

      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = index === 0 ? 'high' : 'low';
      images[index] = image;

      let settled = false;
      const settle = () => {
        if (disposed || settled) return;
        settled = true;
        loaded += 1;

        if (index === 0) {
          if (isImageReady(image)) {
            setFirstFrameLoaded(true);
            setLoadedCount(loaded);
          }
          if (!reducedMotion) {
            scheduleNextBatch();
          }
        } else {
          activeBatch -= 1;
          if (activeBatch === 0) {
            setLoadedCount(loaded);
            scheduleNextBatch();
          }
        }

        flushProgress();
      };

      image.onload = settle;
      image.onerror = settle;
      image.src = getFrameUrl(index + 1);
    }

    function loadBatch() {
      if (disposed || nextIndex >= TOTAL_FRAMES) return;

      const start = nextIndex;
      const end = Math.min(TOTAL_FRAMES, start + batchSize);
      activeBatch = end - start;
      nextIndex = end;

      for (let index = start; index < end; index += 1) {
        loadImage(index);
      }
    }

    loadImage(0);

    return () => {
      disposed = true;

      if (idleCallback !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallback);
      }
      if (timeoutCallback !== null) {
        window.clearTimeout(timeoutCallback);
      }

      images.forEach((image) => {
        if (!image) return;
        image.onload = null;
        image.onerror = null;
      });
      imagesRef.current = [];
    };
  }, [flushProgress, reducedMotion]);

  useEffect(() => {
    const handleResize = () => {
      const drawableFrame = findDrawableFrame(targetFrameRef.current);
      if (!drawableFrame) return;
      drawnFrameRef.current = -1;
      drawFrame(drawableFrame.image, drawableFrame.index);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawFrame, findDrawableFrame]);

  useEffect(() => {
    return () => {
      if (progressRafRef.current !== null) {
        cancelAnimationFrame(progressRafRef.current);
      }
    };
  }, []);

  const loadProgress = Math.round((loadedCount / TOTAL_FRAMES) * 100);

  return (
    <div className={`scroll-frame ${className}`} id="scroll-frame-container">
      <canvas
        ref={canvasRef}
        className="scroll-frame__canvas"
        id="frame-canvas"
      />
      {!firstFrameLoaded && (
        <div className="scroll-frame__loader" id="frame-loader">
          <div className="scroll-frame__loader-ring">
            <svg viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="rgba(200, 169, 126, 0.15)"
                strokeWidth="1.5"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#C8A97E"
                strokeWidth="1.5"
                strokeDasharray={`${loadProgress * 1.256} 125.6`}
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dasharray 0.3s ease' }}
              />
            </svg>
          </div>
          <span className="scroll-frame__loader-text">{loadProgress}%</span>
        </div>
      )}
    </div>
  );
});

export default ScrollFrameAnimation;
