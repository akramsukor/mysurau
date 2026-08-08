import BottomSheet from './ui/BottomSheet';
import PillButton from './ui/PillButton';

// TODO: replace with real App Store URL
const APP_STORE_URL = '#';

export default function DownloadAppSheet({ open, onClose }) {
  return (
    <BottomSheet open={open} onClose={onClose} detent="compact" hideHandle>
      <div className="das-container">
        <div className="das-header">
          <h2 className="das-title">
            Download MySurau and sign up to become a contributor ✨
          </h2>
          <button className="das-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="das-gap" />
        <PillButton onClick={() => window.open(APP_STORE_URL, '_blank', 'noopener')}>
          Get the iOS app
        </PillButton>
      </div>
    </BottomSheet>
  );
}
