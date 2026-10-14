import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PropertyCard from './PropertyCard';
import './PropertyGallery.css';

// Use frames from the animation as gallery thumbnails
const properties = [
  {
    image: '/frames/frames00060.png',
    label: 'PENTHOUSE',
    title: 'The Skyline Suite',
  },
  {
    image: '/frames/frames00100.png',
    label: 'RESIDENCE',
    title: 'The Grand Terrace',
  },
  {
    image: '/frames/frames00140.png',
    label: 'VILLA',
    title: 'The Garden Estate',
  },
];

export default function PropertyGallery() {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    checkScroll();
    window.addEventListener('resize', checkScroll);

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(checkScroll);
    resizeObserver?.observe(el);

    return () => {
      window.removeEventListener('resize', checkScroll);
      resizeObserver?.disconnect();
    };
  }, [checkScroll]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.4;
    el.scrollBy({ left: direction * amount, behavior: 'smooth' });
    setTimeout(checkScroll, 400);
  };

  return (
    <div className="property-gallery" id="property-gallery">
      <div className="property-gallery__header">
        <div className="property-gallery__title-group">
          <span className="property-gallery__label-line"></span>
          <span className="property-gallery__label">FEATURED PROPERTIES</span>
        </div>
        <div className="property-gallery__arrows">
          <button
            type="button"
            className={`property-gallery__arrow ${!canScrollLeft ? 'disabled' : ''}`}
            onClick={() => scroll(-1)}
            disabled={!canScrollLeft}
            aria-label="Previous property"
            id="gallery-prev"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className={`property-gallery__arrow ${!canScrollRight ? 'disabled' : ''}`}
            onClick={() => scroll(1)}
            disabled={!canScrollRight}
            aria-label="Next property"
            id="gallery-next"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        className="property-gallery__scroll"
        ref={scrollRef}
        onScroll={checkScroll}
        id="gallery-scroll"
      >
        {properties.map((property, index) => (
          <PropertyCard
            key={index}
            image={property.image}
            label={property.label}
            title={property.title}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
