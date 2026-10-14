import { useState, useEffect } from 'react';
import { Search, User } from 'lucide-react';
import './Navbar.css';

const navLinks = [
  { label: 'HOME', href: '#home', active: true },
  { label: 'ABOUT US', href: '#about' },
  { label: 'LIFESTYLE', href: '#lifestyle' },
  { label: 'CONTACT', href: '#contact' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`} id="navbar">
      <div className="navbar__container">
        {/* Logo */}
        <a href="#home" className="navbar__logo" id="logo">
          ALTURA
        </a>

        {/* Center Navigation */}
        <div className="navbar__nav" id="nav-links">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`navbar__link ${link.active ? 'navbar__link--active' : ''}`}
              id={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right Actions */}
        <div className="navbar__actions" id="nav-actions">
          <button
            type="button"
            className="navbar__icon-btn"
            id="nav-search"
            aria-label="Search"
          >
            <Search strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="navbar__icon-btn"
            id="nav-user"
            aria-label="User account"
          >
            <User strokeWidth={1.5} />
          </button>
          <a href="#contact" className="navbar__contact-btn" id="nav-contact-btn">
            CONTACT
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          className={`navbar__mobile-toggle ${mobileOpen ? 'active' : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          id="mobile-menu-toggle"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`navbar__mobile-menu ${mobileOpen ? 'open' : ''}`}
        id="mobile-menu"
        aria-hidden={!mobileOpen}
      >
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="navbar__mobile-link"
            onClick={() => setMobileOpen(false)}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
