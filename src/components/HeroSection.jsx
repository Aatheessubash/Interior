import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollFrameAnimation, { TOTAL_FRAMES } from './ScrollFrameAnimation';
import Navbar from './Navbar';
import HeroContent from './HeroContent';
import PropertyIndicator from './PropertyIndicator';
import './HeroSection.css';

gsap.registerPlugin(ScrollTrigger);

// Avoid pin/scroll re-calculations (and resulting jank) when the mobile browser
// toolbar shows/hides during scroll. Orientation changes still refresh normally.
ScrollTrigger.config({ ignoreMobileResize: true });

export default function HeroSection({ onFirstFrameReady }) {
  const sectionRef = useRef(null);
  const frameAnimationRef = useRef(null);
  const indicatorRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();

    const pushProgress = (progress) => {
      frameAnimationRef.current?.setProgress(progress);
      indicatorRef.current?.update(progress);
    };

    media.add('(prefers-reduced-motion: no-preference)', () => {
      // Linear playhead. High numeric scrub heavily glides the frame index so
      // even abrupt scrolls ease in/out; ease stays "none" so scroll distance
      // still maps evenly across the sequence once settled.
      const playhead = { frame: 0 };
      const tween = gsap.to(playhead, {
        frame: TOTAL_FRAMES - 1,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          pin: '.hero-section__sticky',
          pinSpacing: false,
          anticipatePin: 1,
          scrub: 0.25,
        },
        onUpdate: () => pushProgress(playhead.frame / (TOTAL_FRAMES - 1)),
      });

      pushProgress(0);
      return () => tween.kill();
    });

    media.add('(prefers-reduced-motion: reduce)', () => {
      pushProgress(0);
    });

    return () => media.revert();
  }, []);

  return (
    <section className="hero-section" ref={sectionRef} id="home">
      <div className="hero-section__sticky">
        <Navbar />
        <div className="hero-section__bg" />
        <div className="hero-section__frame">
          <ScrollFrameAnimation
            ref={frameAnimationRef}
            reducedMotion={reducedMotion}
            onFirstFrameReady={onFirstFrameReady}
          />
        </div>
        <div className="hero-section__container">
          <div className="hero-section__left">
            <HeroContent />
          </div>
          <PropertyIndicator ref={indicatorRef} />
        </div>
      </div>
    </section>
  );
}
