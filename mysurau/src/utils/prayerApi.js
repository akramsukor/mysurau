/**
 * Fetches Malaysia prayer times from JAKIM data.
 *
 * Primary source : https://api.waktusolat.app  (CORS-friendly wrapper around JAKIM)
 * Fallback source: https://www.e-solat.gov.my  (official JAKIM endpoint)
 */

const WAKTUSOLAT_BASE = 'https://api.waktusolat.app';
const ESOLAT_BASE = 'https://www.e-solat.gov.my';

export const PRAYER_NAMES = {
  imsak: { ms: 'Imsak', en: 'Imsak' },
  fajr: { ms: 'Subuh', en: 'Fajr' },
  syuruk: { ms: 'Syuruk', en: 'Sunrise' },
  dhuhr: { ms: 'Zohor', en: 'Dhuhr' },
  asr: { ms: 'Asar', en: 'Asar' },
  maghrib: { ms: 'Maghrib', en: 'Maghrib' },
  isha: { ms: "Isyak", en: "Isha" },
};

/**
 * Fetch today's prayer times for a given JAKIM zone.
 * Returns a normalized object with prayer keys → "HH:MM" strings, plus hijri/date metadata.
 */
export async function fetchPrayerTimes(zone, date = new Date()) {
  try {
    const data = await fetchFromWaktuSolat(zone, date);
    if (data) return data;
  } catch (err) {
    console.warn('waktusolat.app failed, trying e-solat.gov.my...', err.message);
  }

  // e-solat fallback only supports today
  const isToday = new Date().toDateString() === date.toDateString();
  if (isToday) {
    try {
      const data = await fetchFromESolat(zone);
      if (data) return data;
    } catch (err) {
      console.warn('e-solat.gov.my also failed:', err.message);
    }
  }

  return null;
}

async function fetchFromWaktuSolat(zone, date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const dayIndex = date.getDate() - 1; // 0-indexed

  const res = await fetch(
    `${WAKTUSOLAT_BASE}/v2/solat/${zone}?month=${month}&year=${year}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const prayers = Array.isArray(json.prayers)
    ? json.prayers[dayIndex] || json.prayers[0]
    : json.prayers;

  if (!prayers) throw new Error('No prayer data in response');

  return normalizePrayers(prayers, json);
}

async function fetchFromESolat(zone) {
  const res = await fetch(
    `${ESOLAT_BASE}/index.php?r=esolatApi/TodayPrayerTime&zone=${zone}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (json.status !== 'OK!' && json.status !== 'OK') {
    throw new Error('Bad status from e-solat');
  }

  const pt = json.prayerTime?.[0];
  if (!pt) throw new Error('No prayer time in e-solat response');

  return normalizePrayers(pt, json);
}

function toTimeStr(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    // Accept "HH:MM" or "HH:MM:SS" — strip seconds if present
    return val.slice(0, 5);
  }
  if (typeof val === 'number') {
    // Treat as Unix timestamp (seconds)
    const d = new Date(val * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return '';
}

function subtractMinutes(timeStr, minutes) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m - minutes;
  const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizePrayers(raw, meta = {}) {
  const fajr = toTimeStr(raw.fajr || raw.subuh || raw.subuhTime);
  const imsak = toTimeStr(raw.imsak || raw.imsakTime) || subtractMinutes(fajr, 10);
  return {
    imsak,
    fajr,
    syuruk: toTimeStr(raw.syuruk || raw.syurukTime),
    dhuhr: toTimeStr(raw.dhuhr || raw.zohor || raw.zohorTime),
    asr: toTimeStr(raw.asr || raw.asar || raw.asarTime),
    maghrib: toTimeStr(raw.maghrib || raw.maghribTime),
    isha: toTimeStr(raw.isha || raw.isyak || raw.isyakTime),
    hijri: raw.hijri || meta.hijri || '',
    date: raw.date || meta.date || '',
  };
}

/**
 * Given prayer times, find the current and next prayer names and times.
 */
export function getCurrentAndNextPrayer(prayerTimes) {
  if (!prayerTimes) return { current: null, next: null };

  // Prayers shown in order (exclude imsak and syuruk from main display)
  const ordered = ['fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const now = new Date();

  const toMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return -1;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let currentIndex = -1;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const prayerMin = toMinutes(prayerTimes[ordered[i]]);
    if (prayerMin !== -1 && nowMinutes >= prayerMin) {
      currentIndex = i;
      break;
    }
  }

  // Before Fajr → current is Isha (from yesterday), next is Fajr
  if (currentIndex === -1) {
    return {
      current: { key: 'isha', time: prayerTimes.isha },
      next: { key: 'fajr', time: prayerTimes.fajr },
    };
  }

  const nextIndex = (currentIndex + 1) % ordered.length;
  return {
    current: {
      key: ordered[currentIndex],
      time: prayerTimes[ordered[currentIndex]],
    },
    next: {
      key: ordered[nextIndex],
      time: prayerTimes[ordered[nextIndex]],
    },
  };
}

/**
 * Convert "HH:MM" (24h) to "h:MM AM/PM".
 */
export function to12h(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Return seconds remaining until the next prayer.
 */
export function secondsToNextPrayer(nextPrayerTime) {
  if (!nextPrayerTime || typeof nextPrayerTime !== 'string') return 0;
  const [h, m] = nextPrayerTime.split(':').map(Number);
  const now = new Date();
  let target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.max(0, Math.floor((target - now) / 1000));
}
