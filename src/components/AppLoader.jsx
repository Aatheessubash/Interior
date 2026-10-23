import { useEffect, useRef, useCallback } from 'react';
import lottie from 'lottie-web/build/player/lottie_light';
import loaderData from '../assets/loader-animation.json';
import './AppLoader.css';

/**
 * Full-screen loading overlay shown once on initial page load.
 *
 * Behaviour:
 *   1. Plays a Lottie architectural animation for a minimum of 2 seconds.
 *   2. Tracks how many hero frames have been decoded via `onFrameProgress`.
 *   3. Once the minimum 2 s have elapsed AND at least the first hero frame is
 *      ready, the loader fades out over ~300 ms then calls `onComplete`.
 *
 * Props:
 *   - onComplete()  — called after the exit animation finishes.
 *   - heroReady     — boolean, true once the first hero frame can be drawn.
 */
const MIN_DISPLAY_MS = 2000;
const EXIT_DURATION_MS = 300;

export default function AppLoader({ onComplete, heroReady = false }) {
  const containerRef = useRef(null);
  const lottieRef = useRef(null);
  const mountTimeRef = useRef(Date.now());
  const exitingRef = useRef(false);
  const progressRef = useRef(null);

  // Start exit sequence: wait for remaining MIN_DISPLAY_MS then fade out.
  const beginExit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;

    const elapsed = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      const el = containerRef.current;
      if (!el) { onComplete?.(); return; }

      // Fill the progress bar to 100% before fading out.
      if (progressRef.current) {
        progressRef.current.style.width = '100%';
      }

      // Small delay so the 100% fill is visible before fade.
      setTimeout(() => {
        el.classList.add('is-exiting');

        const afterExit = () => {
          el.removeEventListener('transitionend', afterExit);
          onComplete?.();
        };
        el.addEventListener('transitionend', afterExit);

        // Safety fallback in case transitionend doesn't fire.
        setTimeout(() => onComplete?.(), EXIT_DURATION_MS + 50);
      }, 120);
    }, remaining);
  }, [onComplete]);

  // Watch heroReady prop; trigger exit when it flips to true.
  useEffect(() => {
    if (heroReady) {
      beginExit();
    }
  }, [heroReady, beginExit]);

  // Initialise the Lottie player.
  useEffect(() => {
    if (!containerRef.current) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current.querySelector('.app-loader__animation'),
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: loaderData,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        progressiveLoad: false,
      },
    });
    lottieRef.current = anim;

    // Animate the progress bar loosely while loading.
    let progressRaf;
    const animateProgress = () => {
      const elapsed = Date.now() - mountTimeRef.current;
      // Ease to ~85% over 2 seconds, the remaining 15% fills on exit.
      const t = Math.min(elapsed / MIN_DISPLAY_MS, 1);
      const pct = Math.round(t * 85);
      if (progressRef.current) {
        progressRef.current.style.width = `${pct}%`;
      }
      if (t < 1) progressRaf = requestAnimationFrame(animateProgress);
    };
    progressRaf = requestAnimationFrame(animateProgress);

    return () => {
      anim.destroy();
      lottieRef.current = null;
      if (progressRaf) cancelAnimationFrame(progressRaf);
    };
  }, []);

  return (
    <div ref={containerRef} className="app-loader" id="app-loader">
      <div className="app-loader__animation" />
      <span className="app-loader__brand">ALTURA</span>
      <div className="app-loader__progress">
        <div ref={progressRef} className="app-loader__progress-bar" />
      </div>
    </div>
  );
}
