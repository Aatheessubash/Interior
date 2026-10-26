import { useState, useCallback, useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroSection from './components/HeroSection';
import AppLoader from './components/AppLoader';
import 'lenis/dist/lenis.css';
import './App.css';

gsap.registerPlugin(ScrollTrigger);

function App() {
  const [heroReady, setHeroReady] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);

  useEffect(() => {
    // Initialize Lenis for buttery-smooth momentum scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const onTick = (time) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
    };
  }, []);

  const handleFirstFrameReady = useCallback(() => {
    setHeroReady(true);
  }, []);

  const handleLoaderComplete = useCallback(() => {
    setLoaderDone(true);
  }, []);

  return (
    <div className="app" id="app">
      {!loaderDone && (
        <AppLoader
          heroReady={heroReady}
          onComplete={handleLoaderComplete}
        />
      )}
      <main>
        <HeroSection onFirstFrameReady={handleFirstFrameReady} />
      </main>
    </div>
  );
}

export default App;
