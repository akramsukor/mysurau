import { useState, useEffect, useRef, useCallback } from 'react';
import BottomSheet from './ui/BottomSheet';
import PillButton from './ui/PillButton';
import { supabase } from '../lib/supabase';

// Same SVG mosque path as MapView pin
const MOSQUE_PATH =
  'M10,1.5C8.8,1.5,7.8,2.4,7.2,3.4C6.8,4.1,7,5,7,5H6V6' +
  'H5.5C5,6,4.5,6.5,4.5,7V8H3.5V9H16.5V8H15.5V7C15.5,6.5,15,6,14.5,6H14V5' +
  'H13C13,5,13.2,4.1,12.8,3.4C12.2,2.4,11.2,1.5,10,1.5Z' +
  'M3.5,10V17H7V13.5C7,12.7,8.3,12,10,12C11.7,12,13,12.7,13,13.5V17H16.5V10H3.5Z' +
  'M5,11H7V13H5V11Z M13,11H15V13H13V11Z';

function categoryLabel(cat) {
  if (!cat) return 'Surau';
  const c = cat.toLowerCase();
  if (c.includes('masjid') || c.includes('mosque')) return 'Mosque';
  if (c.includes('musolla') || c.includes('musalla')) return 'Musolla';
  if (c.includes('prayer room') || c.includes('bilik solat')) return 'Prayer room';
  if (c.includes('petrol') || c.includes('station')) return 'Petrol station (surau)';
  return 'Surau';
}

function statusInfo(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'operational') {
    return { label: 'Operational', bg: 'rgba(52,199,89,0.12)', color: '#34C759' };
  }
  if (s.includes('close') || s.includes('temporar')) {
    return { label: 'Temporarily closed', bg: 'rgba(255,59,48,0.12)', color: '#FF3B30' };
  }
  return null;
}

export default function SurauDetailSheet({ open, surau, onClose, onPromptDownload }) {
  // Keep last surau alive so content doesn't vanish during the close animation
  const lastSurauRef = useRef(null);
  if (surau) lastSurauRef.current = surau;
  const s = surau || lastSurauRef.current;

  const [images,       setImages]       = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [activeSlide,  setActiveSlide]  = useState(0);
  const carouselRef = useRef(null);

  // Fetch images whenever the selected surau changes
  useEffect(() => {
    if (!surau || surau.source !== 'supabase') {
      setImages([]);
      setImagesLoading(false);
      return;
    }
    const numId = parseInt(surau.id.slice(3), 10); // "sb_6490" → 6490
    if (isNaN(numId)) { setImages([]); return; }

    setImagesLoading(true);
    setImages([]);
    setActiveSlide(0);

    supabase
      .from('surau_images')
      .select('id,url,position')
      .eq('surau_id', numId)
      .order('position', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setImages(data);
        setImagesLoading(false);
      });
  }, [surau?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el || el.offsetWidth === 0) return;
    setActiveSlide(Math.round(el.scrollLeft / el.offsetWidth));
  }, []);

  const handleDirections = useCallback(() => {
    if (!s) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://?daddr=${s.lat},${s.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
    window.open(url, '_blank', 'noopener');
  }, [s]);

  if (!s) return null;

  const status = statusInfo(s.status);

  return (
    <BottomSheet open={open} onClose={onClose} detent="large" hideHandle>
      <div className="sds-container">

        {/* ── Header ── */}
        <div className="sds-header">
          <button className="sheet-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="sds-body">

          {/* Image area — 16:9 */}
          <div className="sds-image-wrap">
            {imagesLoading ? (
              <div className="sds-image-skeleton shimmer-gray" />
            ) : images.length > 0 ? (
              <>
                <div
                  className="sds-carousel"
                  ref={carouselRef}
                  onScroll={handleCarouselScroll}
                >
                  {images.map(img => (
                    <img
                      key={img.id}
                      className="sds-carousel__img"
                      src={img.url}
                      alt={s.name}
                      loading="lazy"
                    />
                  ))}
                </div>
                {images.length > 1 && (
                  <div className="sds-dots" aria-hidden="true">
                    {images.map((_, i) => (
                      <span
                        key={i}
                        className={`sds-dot${i === activeSlide ? ' sds-dot--active' : ''}`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="sds-image-empty">
                <svg width="40" height="40" viewBox="0 0 20 20" aria-hidden="true">
                  <path fill="#000" opacity="0.25" d={MOSQUE_PATH} />
                </svg>
                <p className="sds-image-empty__label">No photos yet</p>
              </div>
            )}
          </div>

          {/* Title block */}
          <div className="sds-title-row">
            <h1 className="sds-name">{s.name}</h1>
            {s.approved && (
              <span className="sds-approved" title="Verified surau">✓</span>
            )}
          </div>
          <p className="sds-address">{s.address || categoryLabel(s.category)}</p>

          {/* Status pills */}
          {(status || s.friday_prayer || s.public_access) && (
            <div className="sds-pills">
              {status && (
                <span className="sds-pill" style={{ background: status.bg, color: status.color }}>
                  {status.label}
                </span>
              )}
              {s.friday_prayer && (
                <span className="sds-pill sds-pill--teal">Friday prayer</span>
              )}
              {s.public_access && (
                <span className="sds-pill sds-pill--teal-light">Public access</span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="sds-actions">
            <div style={{ flex: 1 }}>
              <PillButton onClick={handleDirections}>Get directions</PillButton>
            </div>
            <button className="sds-btn-suggest" onClick={onPromptDownload}>
              Suggest changes
            </button>
          </div>

          {/* Community card */}
          <div className="sds-community">
            <p className="sds-community__title">Ratings and comments</p>
            <p className="sds-community__body">
              Available in the iOS app. Download to rate and review suraus.
            </p>
            <PillButton onClick={onPromptDownload}>Get the iOS app</PillButton>
          </div>

        </div>
      </div>
    </BottomSheet>
  );
}
