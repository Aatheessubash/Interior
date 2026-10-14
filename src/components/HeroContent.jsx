import { ArrowRight } from 'lucide-react';
import './HeroContent.css';

export default function HeroContent() {
  return (
    <div className="hero-content" id="hero-content">
      <div className="hero-content__label">
        <span className="hero-content__label-line"></span>
        <span className="hero-content__label-text">LUXURY RESIDENCES</span>
      </div>

      <h1 className="hero-content__headline" id="hero-headline">
        <span className="hero-content__headline-line">A</span>
        <span className="hero-content__headline-line">HIGHER</span>
        <span className="hero-content__headline-line">WAY OF</span>
        <span className="hero-content__headline-line">LIVING.</span>
      </h1>

      <p className="hero-content__description" id="hero-description">
        Premium content & cosy living redefined.
      </p>

      <a href="#lifestyle" className="hero-content__cta" id="hero-cta">
        <span className="hero-content__cta-text">DISCOVER</span>
        <ArrowRight className="hero-content__cta-icon" size={16} />
      </a>
    </div>
  );
}
