import { useEffect, useRef } from 'react';
import { PRAYER_KEYS, PRAYER_DISPLAY } from './usePrayerTimes';

// setTimeout max safe delay (~24.8 days). Beyond this the timer fires immediately.
const MAX_DELAY_MS = 2 ** 31 - 1;
const MAX_TIMERS   = 80; // 8 prayers × 10 days

// KL is always UTC+8 (no DST). ISO 8601 with offset is the most reliable constructor.
function fireDateKL(isoDate, timeStr) {
  return new Date(`${isoDate}T${timeStr}:00+08:00`);
}

// "2026-06-06 13:15:00" format for the log line
function klTimestamp(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const g = t => parts.find(p => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
}

export default function usePrayerNotifications({ enabled, cachedPrayerTimes, locationName }) {
  const timersRef = useRef([]);

  useEffect(() => {
    // Always clear existing timers first
    timersRef.current.forEach(id => clearTimeout(id));
    timersRef.current = [];

    if (
      !enabled ||
      typeof Notification === 'undefined' ||
      Notification.permission !== 'granted' ||
      !cachedPrayerTimes.length
    ) return;

    const now      = Date.now();
    const loc      = locationName || 'your area';
    const todayIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
    }).format(new Date());

    // Next 10 days starting from today (ISO string comparison works for yyyy-mm-dd)
    const upcoming = cachedPrayerTimes
      .filter(row => row.isoDate && row.isoDate >= todayIso)
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
      .slice(0, 10);

    let scheduled   = 0;
    let firstFire   = null;
    let firstPrayer = null;

    outer: for (const row of upcoming) {
      for (const key of PRAYER_KEYS) {
        if (scheduled >= MAX_TIMERS) break outer;
        const timeStr = row[key];
        if (!timeStr || !timeStr.includes(':')) continue;

        const fire     = fireDateKL(row.isoDate, timeStr);
        const delayMs  = fire.getTime() - now;
        if (delayMs <= 0 || delayMs > MAX_DELAY_MS) continue;

        const name = PRAYER_DISPLAY[key];
        const id   = setTimeout(() => {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('MySurau', {
              body: `Now ${name} in ${loc}.`,
              tag:  `prayer-${row.isoDate}-${key}`,
            });
          }
        }, delayMs);

        timersRef.current.push(id);
        scheduled++;

        if (!firstFire || fire < firstFire) {
          firstFire   = fire;
          firstPrayer = name;
        }
      }
    }

    if (scheduled > 0 && firstFire) {
      console.info(
        `[prayer-notifications] scheduled ${scheduled} timers, ` +
        `next at ${klTimestamp(firstFire)} (${firstPrayer}, ${loc})`
      );
    } else {
      console.info('[prayer-notifications] no upcoming prayer times found in cache');
    }

    return () => {
      timersRef.current.forEach(id => clearTimeout(id));
      timersRef.current = [];
    };
  }, [enabled, cachedPrayerTimes, locationName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Final cleanup on unmount
  useEffect(() => () => {
    timersRef.current.forEach(id => clearTimeout(id));
  }, []);
}
