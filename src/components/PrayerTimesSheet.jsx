import { useState, useEffect, useRef } from 'react';
import BottomSheet from './ui/BottomSheet';
import { PRAYER_KEYS, PRAYER_DISPLAY } from '../hooks/usePrayerTimes';

function fmt12h(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return '--';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '--';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(2000, 0, 1, h, m));
}

function fmtDate(dateObj) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(dateObj); // "6 Jun 2026"
}

export default function PrayerTimesSheet({
  open,
  onClose,
  sheetPrayerTime,
  sheetHijri,
  currentPrayerIndex,
  isLoadingSheet,
  fetchForDate,
}) {
  const [dateObj, setDateObj] = useState(() => new Date());
  const prevOpen = useRef(false);

  // Reset to today whenever the sheet is opened
  useEffect(() => {
    if (open && !prevOpen.current) {
      const today = new Date();
      setDateObj(today);
    }
    prevOpen.current = open;
  }, [open]);

  const navigate = (delta) => {
    setDateObj(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      fetchForDate(next);
      return next;
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} detent="large">
      <div className="pts-container">

        {/* ── Header ── */}
        <div className="pts-header">
          <span className="pts-title">Waktu Solat</span>
          <button className="pts-close-btn" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {/* ── Date navigation ── */}
        <div className="pts-date-nav">
          <button className="pts-chevron" onClick={() => navigate(-1)} aria-label="Hari sebelum">‹</button>
          <div className="pts-date-center">
            <div className="pts-date-greg">{fmtDate(dateObj)}</div>
            {sheetHijri && <div className="pts-date-hijri">{sheetHijri}</div>}
          </div>
          <button className="pts-chevron" onClick={() => navigate(1)} aria-label="Hari berikut">›</button>
        </div>

        {/* ── Prayer rows ── */}
        <div className="pts-rows">
          {isLoadingSheet ? (
            <div className="pts-loading">Memuatkan…</div>
          ) : (
            PRAYER_KEYS.map((key, i) => (
              <div
                key={key}
                className={`pts-row${i === currentPrayerIndex ? ' pts-row--current' : ''}`}
              >
                <span className="pts-row__name">{PRAYER_DISPLAY[key]}</span>
                <span className="pts-row__time">
                  {fmt12h(sheetPrayerTime?.[key] ?? '')}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="pts-attribution">Sumber: JAKIM e-Solat</div>
      </div>
    </BottomSheet>
  );
}
