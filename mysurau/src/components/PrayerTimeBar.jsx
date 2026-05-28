import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

function formatHijri(date) {
  try {
    return new Intl.DateTimeFormat('ms-MY-u-ca-islamic', {
      day: 'numeric', month: 'long', year: 'numeric',
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

export default function PrayerTimeBar({ prayerTimes, locationName, zone, zoneCode, onZoneClick }) {
  const [countdown, setCountdown] = useState(0);
  const [prayerInfo, setPrayerInfo] = useState({ current: null, next: null });
  const [expanded, setExpanded] = useState(false);
  const [tomorrowPrayerTimes, setTomorrowPrayerTimes] = useState(null);

  // Date switcher state inside expanded panel
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPrayerTimes, setSelectedPrayerTimes] = useState(null);
  const [dateTransitioning, setDateTransitioning] = useState(false);

  const barRef = useRef(null);
  const today = new Date();

  // Update countdown every second
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

  // When current prayer is Isyak, next is tomorrow's Subuh — fetch tomorrow's data
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

  // When expanded panel opens, reset to today
  useEffect(() => {
    if (expanded) {
      setSelectedDate(new Date());
      setSelectedPrayerTimes(prayerTimes);
    }
  }, [expanded, prayerTimes]);

  // Fetch prayer times for selected date in expanded panel
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
  // When next is tomorrow's Subuh, use tomorrow's fajr time instead of today's
  const nextTime = nextIsTomorrow
    ? (to12h(tomorrowPrayerTimes?.fajr) || '—')
    : (to12h(prayerInfo.next?.time) || '—');

  const barBottom = barRef.current?.getBoundingClientRect().bottom ?? 0;

  return (
    <div className="prayer-bar" ref={barRef}>
      {/* Location + Date row */}
      <div className="prayer-bar__top">
        <div className="prayer-bar__location">
          <span className="prayer-bar__location-icon">📍</span>
          <div>
            <div className="prayer-bar__location-name">{locationName}</div>
            <div className="prayer-bar__zone" onClick={onZoneClick} title="Tukar zon">
              {zone} <span className="prayer-bar__zone-edit">✏️</span>
            </div>
          </div>
        </div>
        <div className="prayer-bar__dates">
          <div className="prayer-bar__gregorian">{formatGregorian(today)}</div>
          <div className="prayer-bar__hijri">{formatHijri(today)}</div>
        </div>
      </div>

      {/* Pill */}
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

      {/* Expanded panel */}
      {expanded && prayerTimes && createPortal(
        <div
          className="prayer-expand"
          style={{ top: barBottom }}
          onClick={() => setExpanded(false)}
        >
          {/* Date switcher header */}
          <div className="prayer-expand__date-nav" onClick={(e) => e.stopPropagation()}>
            <button className="prayer-expand__chevron" onClick={() => changeDate(-1)}>‹</button>
            <div className="prayer-expand__date-center">
              <div className="prayer-expand__date-gregorian">{formatGregorian(selectedDate)}</div>
              <div className="prayer-expand__date-hijri">{formatHijri(selectedDate)}</div>
            </div>
            <button className="prayer-expand__chevron" onClick={() => changeDate(1)}>›</button>
          </div>

          {/* Prayer rows */}
          {selectedPrayerTimes ? (
            <div style={{ opacity: dateTransitioning ? 0.4 : 1, transition: 'opacity 0.15s ease' }}>
              {ALL_PRAYERS.map((key) => {
                const isCurrent = isToday && prayerInfo.current?.key === key;
                return (
                  <div
                    key={key}
                    className={`prayer-expand__row${isCurrent ? ' prayer-expand__row--current' : ''}`}
                  >
                    <span className="prayer-expand__name">
                      {PRAYER_NAMES[key]?.ms || key}
                      {isCurrent && (
                        <span className="prayer-expand__badge">({formatCountdown(countdown)})</span>
                      )}
                    </span>
                    <span className="prayer-expand__time">
                      {to12h(selectedPrayerTimes[key]) || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="prayer-expand__loading">Gagal memuatkan waktu solat.</div>
          )}

          <div className="prayer-expand__attribution">
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
