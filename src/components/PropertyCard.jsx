import './PropertyCard.css';

export default function PropertyCard({ image, label, title, index }) {
  return (
    <div className="property-card" id={`property-card-${index}`}>
      <div className="property-card__image-wrapper">
        <img
          src={image}
          alt={title}
          className="property-card__image"
          loading="lazy"
        />
        <div className="property-card__overlay" />
      </div>
      <div className="property-card__info">
        <span className="property-card__label">{label}</span>
        <h3 className="property-card__title">{title}</h3>
      </div>
    </div>
  );
}
