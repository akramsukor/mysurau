function fmt12h(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return timeStr || '--';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(2000, 0, 1, h, m)); // "4:40 PM"
}

export default function PrayerPill({
  currentPrayerName,
  currentPrayerTime,
  nextPrayerName,
  nextPrayerTime,
  countdown,
  onOpenPrayerSheet,
}) {
  const isLoading = currentPrayerName === '--';

  return (
    <div className="pp-outer">
      {isLoading ? (
        <div className="pp-card pp-card--skeleton">
          <div className="pp-col">
            <div className="pp-sk pp-sk--label shimmer-gray" />
            <div className="pp-sk pp-sk--time shimmer-gray" />
          </div>
          <div className="pp-divider" />
          <div className="pp-col pp-col--right">
            <div className="pp-sk pp-sk--label pp-sk--wide shimmer-gray" />
            <div className="pp-sk pp-sk--time shimmer-gray" />
          </div>
        </div>
      ) : (
        <button className="pp-card" onClick={onOpenPrayerSheet}>
          <div className="pp-col">
            <span className="pp-label">Now: {currentPrayerName}</span>
            <span className="pp-time">{fmt12h(currentPrayerTime)}</span>
          </div>
          <div className="pp-divider" />
          <div className="pp-col pp-col--right">
            <span className="pp-label">{nextPrayerName} at {fmt12h(nextPrayerTime)}</span>
            <span className="pp-time">{countdown}</span>
          </div>
        </button>
      )}
    </div>
  );
}
