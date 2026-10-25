import { useState, useEffect } from 'react';

const SESSION_KEY = 'ms_promo_dismissed';

const FEATURES = [
  'Contribute new surau',
  'Search surau',
  'Qibla finder',
  'Prayer alert',
  'Prayer time widget',
];

export default function AppPromoSheet() {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch (_) {}
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setExiting(true);
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}
    setTimeout(() => setVisible(false), 320);
  };

  if (!visible) return null;

  return (
    <div
      className={`promo-backdrop${exiting ? ' promo-backdrop--exiting' : ''}`}
      onClick={dismiss}
    >
      <div
        className={`promo-sheet${exiting ? ' promo-sheet--exiting' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="promo-hero">
          <img src="/app-mockup.png" alt="" className="promo-hero__mockup" />
          <button className="promo-close" onClick={dismiss} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="promo-body">
          <h2 className="promo-title">Continue on app to</h2>
          <ul className="promo-list">
            {FEATURES.map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <div className="promo-badges">
            <a href="#" target="_blank" rel="noopener noreferrer" className="promo-badge-link">
              <img src="/badge-app-store.svg" alt="Download on the App Store" className="promo-badge-img" />
            </a>
            <a href="#" target="_blank" rel="noopener noreferrer" className="promo-badge-link">
              <img src="/badge-google-play.svg" alt="Get it on Google Play" className="promo-badge-img" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
