import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollFrameAnimation from './ScrollFrameAnimation';
import Navbar from './Navbar';
import HeroContent from './HeroContent';
import PropertyIndicator from './PropertyIndicator';
import './HeroSection.css';

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const sectionRef = useRef(null);
  const frameAnimationRef = useRef(null);
  const indicatorPercentRef = useRef(0);
  const [indicatorProgress, setIndicatorProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReducedMotion(mediaQuery.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const media = gsap.matchMedia();

    const updateProgress = (progress) => {
      frameAnimationRef.current?.setProgress(progress);
      const nextPercent = Math.round(progress * 100);

      if (nextPercent !== indicatorPercentRef.current) {
        indicatorPercentRef.current = nextPercent;
        setIndicatorProgress(progress);
      }
    };

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        pin: '.hero-section__sticky',
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 1.2,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateProgress(self.progress),
        onRefresh: (self) => updateProgress(self.progress),
      });

      updateProgress(trigger.progress);

      return () => {
        trigger.kill();
      };
    });

    media.add('(prefers-reduced-motion: reduce)', () => {
      updateProgress(0);
    });

    return () => {
      media.revert();
    };
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
          />
        </div>

        <div className="hero-section__container">
          <div className="hero-section__left">
            <HeroContent />
          </div>
          <PropertyIndicator progress={indicatorProgress} />
        </div>
      </div>
    </section>
  );
}
