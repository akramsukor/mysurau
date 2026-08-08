import { useState, useEffect, useRef } from 'react';
import BottomSheet from './ui/BottomSheet';
import PillButton from './ui/PillButton';

const QIBLA_URL = 'https://qiblafinder.withgoogle.com';
// Fallback is shown after 2 s if the iframe hasn't fired its load event —
// which is the simplest cross-origin detection for X-Frame-Options blocks.
const LOAD_TIMEOUT_MS = 2000;

export default function QiblaSheet({ open, onClose }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showFallback,  setShowFallback]  = useState(false);
  const timerRef = useRef(null);

  // Reset state each time the sheet opens
  useEffect(() => {
    if (open) {
      setIframeLoaded(false);
      setShowFallback(false);
      timerRef.current = setTimeout(() => {
        setShowFallback(prev => !prev); // only show if iframe hasn't loaded
      }, LOAD_TIMEOUT_MS);
    } else {
      clearTimeout(timerRef.current);
    }
    return () => clearTimeout(timerRef.current);
  }, [open]);

  const handleIframeLoad = () => {
    clearTimeout(timerRef.current);
    setIframeLoaded(true);
    setShowFallback(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} detent="large" hideHandle>
      <div className="qs-container">
        <div className="qs-header">
          <span className="qs-title">Qibla Finder</span>
          <button className="sheet-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="qs-body">
          <iframe
            className="qs-iframe"
            src={QIBLA_URL}
            title="Qibla Finder"
            onLoad={handleIframeLoad}
            allow="geolocation"
          />

          {/* Fallback: shown if iframe blocks due to X-Frame-Options */}
          {showFallback && !iframeLoaded && (
            <div className="qs-fallback">
              <p className="qs-fallback-text">
                The Qibla Finder couldn't load in-app.
              </p>
              <PillButton onClick={() => window.open(QIBLA_URL, '_blank', 'noopener')}>
                Open Qibla Finder
              </PillButton>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
