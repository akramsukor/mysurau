// Prayer time data layer.
// Primary: e-solat.gov.my monthly endpoint (via CORS proxy on Vercel).
// Fallback: api.waktusolat.app (CORS-friendly).
// All time arithmetic is done in Asia/Kuala_Lumpur (MYT UTC+8).

export const PRAYER_NAMES = {
  imsak:   { ms: 'Imsak',   en: 'Imsak' },
  fajr:    { ms: 'Subuh',   en: 'Fajr' },
  syuruk:  { ms: 'Syuruk',  en: 'Sunrise' },
  dhuhr:   { ms: 'Zohor',   en: 'Dhuhr' },
  asr:     { ms: 'Asar',    en: 'Asar' },
  maghrib: { ms: 'Maghrib', en: 'Maghrib' },
  isha:    { ms: 'Isyak',   en: 'Isha' },
};

/* ── MYT helpers ── */

function nowMYT() {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const p = {};
  for (const { type, value } of parts) p[type] = value;
  return {
    year:   parseInt(p.year,   10),
    month:  parseInt(p.month,  10),  // 1-indexed
    day:    parseInt(p.day,    10),
    hour:   parseInt(p.hour,   10) % 24,  // Intl can return 24 at midnight
    minute: parseInt(p.minute, 10),
    second: parseInt(p.second, 10),
  };
}

/* ── Date parsing for e-solat "dd-MonthName-yyyy" format ── */

const MONTH_LOOKUP = {
  'jan':1,'january':1,'januari':1,
  'feb':2,'february':2,'februari':2,
  'mac':3,'mar':3,'march':3,
  'apr':4,'april':4,
  'may':5,'mei':5,
  'jun':6,'june':6,
  'jul':7,'july':7,'julai':7,
  'ogo':8,'ogos':8,'aug':8,'august':8,
  'sep':9,'sept':9,'september':9,
  'okt':10,'oct':10,'oktober':10,'october':10,
  'nov':11,'november':11,
  'dis':12,'dec':12,'disember':12,'december':12,
};

function parseJakimDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const day   = parseInt(parts[0], 10);
  const month = MONTH_LOOKUP[parts[1].toLowerCase()];
  const year  = parseInt(parts[2], 10);
  if (!month || isNaN(day) || isNaN(year)) return null;
  return { day, month, year };
}

/* ── Normalise raw row to consistent shape ── */

function toTimeStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 5);  // "HH:MM:SS" → "HH:MM"
  if (typeof val === 'number') {
    // Unix timestamp (seconds) from waktusolat.app
    const d = new Date(val * 1000);
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const h = parts.find(p => p.type === 'hour')?.value  || '00';
    const m = parts.find(p => p.type === 'minute')?.value || '00';
    return `${h}:${m}`;
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

function normalizeRow(raw) {
  const fajr  = toTimeStr(raw.fajr  || raw.subuh || raw.subuhTime);
  const imsak = toTimeStr(raw.imsak || raw.imsakTime) || subtractMinutes(fajr, 10);
  return {
    imsak,
    fajr,
    syuruk:  toTimeStr(raw.syuruk  || raw.syurukTime),
    dhuhr:   toTimeStr(raw.dhuhr   || raw.zohor || raw.zohorTime),
    asr:     toTimeStr(raw.asr     || raw.asar  || raw.asarTime),
    maghrib: toTimeStr(raw.maghrib || raw.maghribTime),
    isha:    toTimeStr(raw.isha    || raw.isyak || raw.isyakTime),
    hijri:   raw.hijri || '',
    date:    raw.date  || '',
  };
}

/* ── Month-level cache ── */

// key: `${zone}-${year}-${month}` → raw rows array
const PRAYER_CACHE = new Map();

async function fetchMonth(zone, year, month) {
  const key = `${zone}-${year}-${month}`;
  if (PRAYER_CACHE.has(key)) return PRAYER_CACHE.get(key);

  let rows = null;

  // 1. Try e-solat directly (often blocked by CORS in the browser)
  try {
    const url =
      `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat` +
      `&period=month&zone=${zone}&year=${year}&month=${month}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.prayerTime) && json.prayerTime.length) {
        rows = json.prayerTime;
      }
    }
  } catch {}

  // 2. Proxy (Vercel edge function — removes CORS restriction)
  if (!rows) {
    try {
      const res = await fetch(
        `/api/prayer?zone=${zone}&year=${year}&month=${month}`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.prayerTime) && json.prayerTime.length) {
          rows = json.prayerTime;
        }
      }
    } catch {}
  }

  // 3. waktusolat.app fallback — CORS-friendly, different shape
  if (!rows) {
    try {
      const res = await fetch(
        `https://api.waktusolat.app/v2/solat/${zone}?month=${month}&year=${year}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.prayers) && json.prayers.length) {
          // Tag each row with its 1-based day index so findRow can match by day
          rows = json.prayers.map((p, i) => ({ ...p, _dayIdx: i + 1 }));
        }
      }
    } catch {}
  }

  if (rows) PRAYER_CACHE.set(key, rows);
  return rows || null;
}

function findRow(rows, day) {
  // e-solat rows have a "date" string ("01-Ogos-2026"); parse it.
  // waktusolat rows have a _dayIdx property.
  for (const row of rows) {
    if (row._dayIdx !== undefined) {
      if (row._dayIdx === day) return row;
    } else {
      const parsed = parseJakimDate(row.date);
      if (parsed && parsed.day === day) return row;
    }
  }
  // Fallback: treat array as 0-indexed day list (some API shapes)
  return rows[day - 1] || null;
}

/* ── Public API ── */

export async function fetchPrayerTimes(zone, date = null) {
  let year, month, day;
  if (date) {
    year  = date.getFullYear();
    month = date.getMonth() + 1;
    day   = date.getDate();
  } else {
    const myt = nowMYT();
    year  = myt.year;
    month = myt.month;
    day   = myt.day;
  }

  const rows = await fetchMonth(zone, year, month);
  if (!rows) return null;

  const row = findRow(rows, day);
  if (!row) return null;

  return normalizeRow(row);
}

export function getCurrentAndNextPrayer(prayerTimes) {
  if (!prayerTimes) return { current: null, next: null };

  const ordered = ['fajr', 'syuruk', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const { hour, minute } = nowMYT();
  const nowMinutes = hour * 60 + minute;

  let currentIndex = -1;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const t = prayerTimes[ordered[i]];
    if (!t) continue;
    const [h, m] = t.split(':').map(Number);
    if (nowMinutes >= h * 60 + m) { currentIndex = i; break; }
  }

  // Between midnight and Fajr → current is (yesterday's) Isha, next is Fajr
  if (currentIndex === -1) {
    return {
      current: { key: 'isha',  time: prayerTimes.isha },
      next:    { key: 'fajr',  time: prayerTimes.fajr },
    };
  }

  const nextIndex = (currentIndex + 1) % ordered.length;
  return {
    current: { key: ordered[currentIndex], time: prayerTimes[ordered[currentIndex]] },
    next:    { key: ordered[nextIndex],    time: prayerTimes[ordered[nextIndex]] },
  };
}

export function secondsToNextPrayer(nextPrayerTime) {
  if (!nextPrayerTime || typeof nextPrayerTime !== 'string') return 0;
  const [h, m] = nextPrayerTime.split(':').map(Number);
  const { hour, minute, second } = nowMYT();
  const nowSecs    = hour * 3600 + minute * 60 + second;
  const targetSecs = h   * 3600 + m      * 60;
  let diff = targetSecs - nowSecs;
  if (diff <= 0) diff += 86400;
  return Math.max(0, diff);
}

export function to12h(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
