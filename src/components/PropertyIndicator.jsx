import { forwardRef, useImperativeHandle, useRef } from 'react';
import './PropertyIndicator.css';

const PropertyIndicator = forwardRef(function PropertyIndicator(_, ref) {
  const currentRef = useRef(null);
  const fillRef = useRef(null);
  const dotRef = useRef(null);
  const lastIndexRef = useRef(1);

  useImperativeHandle(
    ref,
    () => ({
      update(progress) {
        const p = Math.max(0, Math.min(1, Number(progress) || 0));
        const totalProperties = 2;
        const currentIndex =
          Math.min(Math.floor(p * totalProperties), totalProperties - 1) + 1;

        if (currentRef.current && currentIndex !== lastIndexRef.current) {
          lastIndexRef.current = currentIndex;
          currentRef.current.textContent = String(currentIndex).padStart(2, '0');
        }

        const pct = p * 100;
        if (fillRef.current) {
          fillRef.current.style.height = `${Math.max(pct, 5)}%`;
        }
        if (dotRef.current) {
          dotRef.current.style.top = `${pct}%`;
        }
      },
    }),
    []
  );

  return (
    <div className="property-indicator" id="property-indicator">
      <span className="property-indicator__current" ref={currentRef}>
        01
      </span>

      <div className="property-indicator__track">
        <div
          ref={fillRef}
          className="property-indicator__fill"
          style={{ height: '5%' }}
        />
        <div
          ref={dotRef}
          className="property-indicator__dot"
          style={{ top: '0%' }}
        />
      </div>

      <span className="property-indicator__total">02</span>
    </div>
  );
});

export default PropertyIndicator;
