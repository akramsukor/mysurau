import { useState, useEffect } from 'react';
import BottomSheet from './ui/BottomSheet';
import Toggle from './ui/Toggle';
import QiblaSheet from './QiblaSheet';
import FeedbackSheet from './FeedbackSheet';

const LS_KEY = 'prayer_alert_enabled';

function loadAlertPref() {
  try { return localStorage.getItem(LS_KEY) !== 'false'; } catch { return true; }
}

function saveAlertPref(val) {
  try { localStorage.setItem(LS_KEY, String(val)); } catch { /* ignore */ }
}

function MenuRow({ emoji, label, onTap, right }) {
  return (
    <button className="md-row" onClick={onTap}>
      <span className="md-emoji-badge">{emoji}</span>
      <span className="md-label">{label}</span>
      {right && <span className="md-right">{right}</span>}
    </button>
  );
}

function Divider() {
  return <div className="md-divider" />;
}

export default function MenuDrawer({ open, onClose, onPromptDownload }) {
  const [alertOn,       setAlertOn]       = useState(loadAlertPref);
  const [notifBlocked,  setNotifBlocked]  = useState(false);
  const [qiblaOpen,     setQiblaOpen]     = useState(false);
  const [feedbackOpen,  setFeedbackOpen]  = useState(false);

  // Sync toggle with actual browser permission on open
  useEffect(() => {
    if (!open) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setAlertOn(false);
      saveAlertPref(false);
    }
  }, [open]);

  const handleAlertToggle = async (next) => {
    if (next) {
      // Turning ON → request permission
      if (typeof Notification === 'undefined') {
        setAlertOn(false);
        setNotifBlocked(true);
        return;
      }
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        setAlertOn(true);
        setNotifBlocked(false);
        saveAlertPref(true);
      } else {
        setAlertOn(false);
        setNotifBlocked(true);
        saveAlertPref(false);
      }
    } else {
      // Turning OFF
      setAlertOn(false);
      setNotifBlocked(false);
      saveAlertPref(false);
    }
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} detent="large" hideHandle>
        <div className="md-container">

          {/* ── Header ── */}
          <div className="md-header">
            <button className="sheet-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {/* ── Section 1: Contributor CTA ── */}
          <div className="md-card md-card--teal">
            <MenuRow
              emoji="🪪"
              label="Become a contributor"
              onTap={onPromptDownload}
            />
          </div>

          {/* ── Section 2: Preferences ── */}
          <div className="md-card">
            <div className="md-row md-row--notoggle">
              <span className="md-emoji-badge">🔔</span>
              <span className="md-label">Prayer alert</span>
              <span className="md-right">
                <Toggle on={alertOn} onChange={handleAlertToggle} />
              </span>
            </div>
            {notifBlocked && (
              <p className="md-notif-hint">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            )}
          </div>

          {/* ── Section 3: Tools ── */}
          <div className="md-card">
            <MenuRow
              emoji="🕋"
              label="Qibla Finder"
              onTap={() => setQiblaOpen(true)}
            />
            <Divider />
            <MenuRow
              emoji="✍🏻"
              label="Feedback"
              onTap={() => setFeedbackOpen(true)}
            />
          </div>

          {/* ── Footer ── */}
          <p className="md-version">Version 1.0.0</p>
        </div>
      </BottomSheet>

      {/* Nested sheets — rendered outside the drawer BottomSheet to avoid z-index conflict */}
      <QiblaSheet    open={qiblaOpen}    onClose={() => setQiblaOpen(false)} />
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
