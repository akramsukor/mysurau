import { useState, useEffect } from 'react';
import {
  PRAYER_NAMES,
  getCurrentAndNextPrayer,
  secondsToNextPrayer,
  fetchPrayerTimes,
  to12h,
} from '../utils/prayerApi';

function formatCountdown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatGregorian(date) {
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date);
}

function formatHijri(date) {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

const ALL_PRAYERS = ['fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha'];

export default function PrayerTimeBar({
  prayerTimes,
  locationName,
  zoneCode,
  onRefresh,
}) {
  const [countdown, setCountdown] = useState(0);
  const [prayerInfo, setPrayerInfo] = useState({ current: null, next: null });
  const [expanded, setExpanded] = useState(false);
  const [tomorrowPrayerTimes, setTomorrowPrayerTimes] = useState(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPrayerTimes, setSelectedPrayerTimes] = useState(null);
  const [dateTransitioning, setDateTransitioning] = useState(false);

  const today = new Date();

  useEffect(() => {
    if (!prayerTimes) return;
    const update = () => {
      const info = getCurrentAndNextPrayer(prayerTimes);
      setPrayerInfo(info);
      if (info.next?.time) setCountdown(secondsToNextPrayer(info.next.time));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [prayerTimes]);

  useEffect(() => {
    if (!zoneCode || !prayerInfo.current) return;
    if (prayerInfo.current.key === 'isha') {
      fetchPrayerTimes(zoneCode, tomorrow())
        .then((data) => setTomorrowPrayerTimes(data))
        .catch(() => {});
    } else {
      setTomorrowPrayerTimes(null);
    }
  }, [prayerInfo.current?.key, zoneCode]);

  useEffect(() => {
    if (expanded) {
      setSelectedDate(new Date());
      setSelectedPrayerTimes(prayerTimes);
    }
  }, [expanded, prayerTimes]);

  useEffect(() => {
    if (!expanded || !zoneCode) return;
    if (isSameDay(selectedDate, today)) {
      setSelectedPrayerTimes(prayerTimes);
      return;
    }
    setDateTransitioning(true);
    fetchPrayerTimes(zoneCode, selectedDate)
      .then((data) => setSelectedPrayerTimes(data))
      .catch(() => {})
      .finally(() => setDateTransitioning(false));
  }, [selectedDate, expanded, zoneCode]);

  const changeDate = (delta) => {
    setSelectedDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + delta);
      return next;
    });
  };

  const isToday = isSameDay(selectedDate, today);
  const nextIsTomorrow = prayerInfo.current?.key === 'isha';

  const currentName = prayerInfo.current
    ? PRAYER_NAMES[prayerInfo.current.key]?.ms || prayerInfo.current.key
    : '—';
  const currentTime = to12h(prayerInfo.current?.time) || '—';
  const nextName = prayerInfo.next
    ? PRAYER_NAMES[prayerInfo.next.key]?.ms || prayerInfo.next.key
    : '—';
  const nextTime = nextIsTomorrow
    ? (to12h(tomorrowPrayerTimes?.fajr) || '—')
    : (to12h(prayerInfo.next?.time) || '—');

  return (
    <>
      {/* Transparent backdrop — clicking outside collapses the expansion */}
      {expanded && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
      )}

    <div className="prayer-bar">
      {/* Card header: location + refresh */}
      <div className="prayer-bar__header">
        <div className="prayer-bar__location-row">
          <span className="prayer-bar__location-name">
            {locationName}
          </span>
          <button className="prayer-bar__refresh-btn" onClick={onRefresh} title="Muat Semula">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74" />
              <polyline points="3 3 3 9 9 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date row */}
      <div className="prayer-bar__date">
        {formatGregorian(today)} | {formatHijri(today)}
      </div>

      {/* Prayer pill */}
      {prayerTimes ? (
        <div className="prayer-pill" onClick={() => setExpanded((v) => !v)}>
          <div className="prayer-pill__side">
            <div className="prayer-pill__label">Now: {currentName}</div>
            <div className="prayer-pill__time">{currentTime}</div>
          </div>
          <div className="prayer-pill__divider" />
          <div className="prayer-pill__side prayer-pill__side--right">
            <div className="prayer-pill__label">{nextName} at {nextTime}</div>
            <div className="prayer-pill__time prayer-pill__countdown">{formatCountdown(countdown)}</div>
          </div>
        </div>
      ) : (
        <div className="prayer-bar__loading">Memuatkan waktu solat…</div>
      )}

      {/* Inline expanded prayer times */}
      {prayerTimes && (
        <div className={`prayer-inline${expanded ? ' prayer-inline--open' : ''}`}>
          <div className="prayer-inline__inner">
            {/* Date navigator */}
            <div className="prayer-inline__date-nav">
              <button className="prayer-inline__chevron" onClick={() => changeDate(-1)}>‹</button>
              <div className="prayer-inline__date-text">
                <div>{formatGregorian(selectedDate)}</div>
                <div className="prayer-inline__date-hijri">{formatHijri(selectedDate)}</div>
              </div>
              <button className="prayer-inline__chevron" onClick={() => changeDate(1)}>›</button>
            </div>

            {/* Prayer rows */}
            {selectedPrayerTimes ? (
              <div style={{ opacity: dateTransitioning ? 0.4 : 1, transition: 'opacity 0.15s ease' }}>
                {ALL_PRAYERS.map((key) => {
                  const isCurrent = isToday && prayerInfo.current?.key === key;
                  return (
                    <div
                      key={key}
                      className={`prayer-inline__row${isCurrent ? ' prayer-inline__row--current' : ''}`}
                    >
                      <span className="prayer-inline__name">
                        {PRAYER_NAMES[key]?.ms || key}
                        {isCurrent && (
                          <span className="prayer-inline__badge"> ({formatCountdown(countdown)})</span>
                        )}
                      </span>
                      <span className="prayer-inline__time">
                        {to12h(selectedPrayerTimes[key]) || '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="prayer-inline__loading">Memuatkan…</div>
            )}

            {/* Collapse ghost button */}
            <button className="prayer-collapse-btn" onClick={() => setExpanded(false)}>
              Collapse
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6, verticalAlign: 'middle' }}>
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
