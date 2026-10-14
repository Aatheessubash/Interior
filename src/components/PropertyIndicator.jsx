import './PropertyIndicator.css';

export default function PropertyIndicator({ progress = 0 }) {
  const totalProperties = 2;
  const currentIndex = Math.min(
    Math.floor(progress * totalProperties),
    totalProperties - 1
  );

  return (
    <div className="property-indicator" id="property-indicator">
      <span className="property-indicator__current">
        {String(currentIndex + 1).padStart(2, '0')}
      </span>

      <div className="property-indicator__track">
        <div
          className="property-indicator__fill"
          style={{ height: `${Math.max(progress * 100, 5)}%` }}
        />
        <div
          className="property-indicator__dot"
          style={{ top: `${Math.max(progress * 100, 0)}%` }}
        />
      </div>

      <span className="property-indicator__total">
        {String(totalProperties).padStart(2, '0')}
      </span>
    </div>
  );
}
