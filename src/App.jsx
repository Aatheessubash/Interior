import { useState, useCallback } from 'react';
import HeroSection from './components/HeroSection';
import AppLoader from './components/AppLoader';
import './App.css';

function App() {
  const [heroReady, setHeroReady] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);

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
