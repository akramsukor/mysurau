import { useState, useEffect } from 'react';
import BottomSheet from './ui/BottomSheet';
import Toggle from './ui/Toggle';
import QiblaSheet from './QiblaSheet';
import FeedbackSheet from './FeedbackSheet';

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

/**
 * alertOn and onAlertChange are lifted to App so usePrayerNotifications
 * can read the same value. MenuDrawer still owns the permission UX
 * (Notification.requestPermission call + blocked hint).
 */
export default function MenuDrawer({ open, onClose, onPromptDownload, alertOn, onAlertChange }) {
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [qiblaOpen,    setQiblaOpen]    = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Sync with actual browser permission when drawer opens
  useEffect(() => {
    if (!open) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      onAlertChange(false);
    }
  }, [open, onAlertChange]);

  const handleAlertToggle = async (next) => {
    if (next) {
      if (typeof Notification === 'undefined') {
        setNotifBlocked(true);
        onAlertChange(false);
        return;
      }
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        setNotifBlocked(false);
        onAlertChange(true);
      } else {
        setNotifBlocked(true);
        onAlertChange(false);
      }
    } else {
      setNotifBlocked(false);
      onAlertChange(false);
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

            {/* Permission-denied hint (Slice 6) */}
            {notifBlocked && (
              <p className="md-notif-hint">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            )}

            {/* Foreground-only caveat (Slice 8) — visible when toggle is ON */}
            {alertOn && !notifBlocked && (
              <p className="md-notif-subrow">
                Notifications fire while this tab is open. For background alerts,{' '}
                <button className="md-notif-ios-link" onClick={onPromptDownload}>
                  get the iOS app
                </button>
                .
              </p>
            )}
          </div>

          {/* ── Section 3: Tools ── */}
          <div className="md-card">
            <MenuRow emoji="🕋" label="Qibla Finder" onTap={() => setQiblaOpen(true)} />
            <Divider />
            <MenuRow emoji="✍🏻" label="Feedback" onTap={() => setFeedbackOpen(true)} />
          </div>

          {/* ── Footer ── */}
          <p className="md-version">Version 1.0.0</p>
        </div>
      </BottomSheet>

      <QiblaSheet    open={qiblaOpen}    onClose={() => setQiblaOpen(false)} />
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
