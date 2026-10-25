import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSurauImages, getCategoryColor, getCategoryLabel, formatDistance } from '../utils/surauApi';

function toRgba(color, alpha) {
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function SurauModal({ surau, userLocation, onClose }) {
  const [images, setImages] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [imgErrors, setImgErrors] = useState(new Set());
  const [showNav, setShowNav] = useState(false);
  const [showAccessInfo, setShowAccessInfo] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const modalRef = useRef(null);
  const dragRef = useRef({ startX: 0, active: false });

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const pinColor = getCategoryColor(surau.category);
  const heroTint = toRgba(pinColor, 0.14);
  const isClosed = surau.status === 'temporarily_closed';
  const distance = surau.distance != null ? formatDistance(surau.distance) : null;

  useEffect(() => {
    setImages(null);
    setImgIdx(0);
    setImgErrors(new Set());
    fetchSurauImages(surau.id)
      .then(setImages)
      .catch(() => setImages([]));
  }, [surau.id]);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showNav) { setShowNav(false); return; }
      if (showAccessInfo) { setShowAccessInfo(false); return; }
      handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose, showNav, showAccessInfo]);

  // Focus trap
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const onTab = (e) => {
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, []);

  const prevImg = useCallback(() => {
    if (!images?.length) return;
    setImgIdx(v => (v - 1 + images.length) % images.length);
  }, [images]);

  const nextImg = useCallback(() => {
    if (!images?.length) return;
    setImgIdx(v => (v + 1) % images.length);
  }, [images]);

  const onPointerDown = (e) => {
    dragRef.current = { startX: e.clientX, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const diff = dragRef.current.startX - e.clientX;
    if (Math.abs(diff) > 50) diff > 0 ? nextImg() : prevImg();
  };

  const hasImages = images && images.length > 0;
  const currentErrored = imgErrors.has(imgIdx);

  return (
    <div
      className={`smodal-backdrop${isExiting ? ' smodal-backdrop--exiting' : ''}`}
      onClick={() => { if (!showNav && !showAccessInfo) handleClose(); }}
    >
      <div
        ref={modalRef}
        className={`smodal-card${isExiting ? ' smodal-card--exiting' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={surau.name}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {/* Hero */}
        <div
          className="smodal-hero"
          style={{ background: heroTint }}
          onPointerDown={hasImages && images.length > 1 ? onPointerDown : undefined}
          onPointerUp={hasImages && images.length > 1 ? onPointerUp : undefined}
          onPointerCancel={() => { dragRef.current.active = false; }}
        >
          {images === null ? (
            <div className="smodal-hero__placeholder" style={{ background: heroTint }}>
              <div className="smodal-spinner" />
            </div>
          ) : hasImages && !currentErrored ? (
            <img
              src={images[imgIdx].url}
              alt={surau.name}
              className="smodal-hero__img"
              draggable={false}
              onError={() => setImgErrors(prev => new Set([...prev, imgIdx]))}
            />
          ) : (
            <div className="smodal-hero__placeholder" style={{ background: heroTint }}>
              <img src="/icon.png" alt="" className="smodal-hero__fallback-icon" />
            </div>
          )}

          {hasImages && images.length > 1 && (
            <>
              <button
                className="smodal-hero__arrow smodal-hero__arrow--prev"
                onClick={e => { e.stopPropagation(); prevImg(); }}
                aria-label="Previous image"
              >‹</button>
              <button
                className="smodal-hero__arrow smodal-hero__arrow--next"
                onClick={e => { e.stopPropagation(); nextImg(); }}
                aria-label="Next image"
              >›</button>
              <div className="smodal-dots" aria-hidden="true">
                {images.map((_, i) => (
                  <button
                    key={i}
                    className={`smodal-dot${i === imgIdx ? ' smodal-dot--active' : ''}`}
                    onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                    aria-label={`Image ${i + 1}`}
                    tabIndex={-1}
                  />
                ))}
              </div>
            </>
          )}

          <button className="smodal-close" onClick={handleClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="smodal-body">
          <h2 className="smodal-name">{surau.name}</h2>

          <div className="smodal-chips">
            <span className="smodal-chip">{getCategoryLabel(surau.category)}</span>
            {distance && <span className="smodal-chip">{distance}</span>}
            {isClosed ? (
              <span className="smodal-chip smodal-chip--closed">🔒 Temporarily Closed</span>
            ) : (
              <>
                {surau.friday_prayer && (
                  <span className="smodal-chip smodal-chip--friday">✓ Friday prayer</span>
                )}
                {surau.public_access === false && (
                  <button
                    className="smodal-chip smodal-chip--access"
                    onClick={() => setShowAccessInfo(true)}
                  >
                    🔒 Need access ›
                  </button>
                )}
              </>
            )}
          </div>

          <div className="smodal-address">
            <div className="smodal-address__label">Address</div>
            <div className="smodal-address__text">{surau.address || 'No address yet.'}</div>
            {(surau.city || surau.id != null) && (
              <div className="smodal-address__meta">
                {[
                  surau.city || null,
                  surau.id != null
                    ? `Reference ID: ${String(surau.id).padStart(5, '0')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
            )}
          </div>

          <button className="smodal-nav-btn" onClick={() => setShowNav(true)}>
            Navigate
          </button>
        </div>

        {/* Navigate chooser */}
        {showNav && (
          <div className="smodal-overlay" onClick={() => setShowNav(false)}>
            <div className="smodal-chooser" onClick={e => e.stopPropagation()}>
              <div className="smodal-chooser__title">Driving direction</div>
              {[
                {
                  label: 'Waze',
                  url: `https://waze.com/ul?ll=${surau.lat},${surau.lon}&navigate=yes`,
                },
                {
                  label: 'Google Maps',
                  url: `https://www.google.com/maps/dir/?api=1&destination=${surau.lat},${surau.lon}&travelmode=driving`,
                },
                {
                  label: 'Apple Maps',
                  url: `https://maps.apple.com/?daddr=${surau.lat},${surau.lon}&dirflg=d`,
                },
              ].map(({ label, url }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="smodal-chooser__row"
                  onClick={() => setShowNav(false)}
                >
                  <span>{label}</span>
                  <span className="smodal-chooser__chevron">›</span>
                </a>
              ))}
              <button className="smodal-chooser__cancel" onClick={() => setShowNav(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Access info overlay */}
        {showAccessInfo && (
          <div className="smodal-overlay" onClick={() => setShowAccessInfo(false)}>
            <div className="smodal-chooser" onClick={e => e.stopPropagation()}>
              <div className="smodal-chooser__title">This surau needs special access 🔐</div>
              <p className="smodal-access__body">
                This location isn't open to the public. You may need a ticket, pass,
                or special permission to enter.
              </p>
              <button className="smodal-nav-btn" onClick={() => setShowAccessInfo(false)}>
                Got it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
