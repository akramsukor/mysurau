import { useState, useEffect, useRef, useCallback } from 'react';

const KL_TZ = 'Asia/Kuala_Lumpur';

export const PRAYER_KEYS = ['imsak', 'fajr', 'syuruk', 'dhuha', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_DISPLAY = {
  imsak: 'Imsak', fajr: 'Subuh', syuruk: 'Syuruk', dhuha: 'Dhuha',
  dhuhr: 'Zuhur', asr: 'Asar', maghrib: 'Maghrib', isha: 'Isyak',
};

// ── KL time helpers (Intl-based, no raw Date math) ──────────────────────────

function klTimeParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KL_TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = t => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
  return { h: get('hour') % 24, m: get('minute'), s: get('second') };
}

function klDateKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KL_TZ }).format(new Date());
}

function klDateParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KL_TZ,
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const get = t => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// ── Hijri formatting ─────────────────────────────────────────────────────────

const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabiulawal', 'Rabiulakhir',
  'Jamadilawal', 'Jamadilakhir', 'Rejab', 'Syaaban',
  'Ramadan', 'Syawal', 'Zulkaedah', 'Zulhijjah',
];

// Converts "1447-12-20" → "20 Zulhijjah 1447". Passes through already-formatted strings.
function formatHijri(str) {
  if (!str) return '';
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return str; // already human-readable (e.g. from e-solat)
  const month = HIJRI_MONTHS[parseInt(m[2], 10) - 1] ?? `Bulan ${m[2]}`;
  return `${parseInt(m[3], 10)} ${month} ${m[1]}`;
}

// ── Data helpers ─────────────────────────────────────────────────────────────

function toHHMM(str) {
  return (str || '').slice(0, 5);
}

function addMinutesToTime(timeStr, mins) {
  if (!timeStr || !timeStr.includes(':')) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(nh / 60)).padStart(2, '0')}:${String(nh % 60).padStart(2, '0')}`;
}

function normalizeRow(raw) {
  const fajr   = toHHMM(raw.fajr    || raw.subuh   || '');
  const syuruk = toHHMM(raw.syuruk  || '');
  return {
    imsak:   toHHMM(raw.imsak || '') || (fajr ? addMinutesToTime(fajr, -10) : ''),
    fajr,
    syuruk,
    dhuha:   syuruk ? addMinutesToTime(syuruk, 28) : '',
    dhuhr:   toHHMM(raw.dhuhr || raw.zohor  || ''),
    asr:     toHHMM(raw.asr   || raw.asar   || ''),
    maghrib: toHHMM(raw.maghrib || ''),
    isha:    toHHMM(raw.isha  || raw.isyak  || ''),
    hijri: formatHijri(raw.hijri || ''),
    date:  raw.date  || '',
  };
}

function timeToSecs(timeStr) {
  if (!timeStr || timeStr.length < 5) return -1;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 3600 + m * 60;
}

// ── Network ──────────────────────────────────────────────────────────────────

async function fetchMonthData(zoneCode, year, month) {
  // Primary: waktusolat.app (CORS-friendly wrapper)
  try {
    const res = await fetch(
      `https://api.waktusolat.app/v2/solat/${zoneCode}?month=${month}&year=${year}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.prayers) && json.prayers.length > 0) {
        return json.prayers.map(normalizeRow);
      }
    }
  } catch (_) { /* fall through to e-solat */ }

  // Fallback: official JAKIM e-Solat monthly endpoint
  const res = await fetch(
    `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=month&zone=${zoneCode}&year=${year}&month=${month}`,
    { signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error(`e-solat HTTP ${res.status}`);
  const json = await res.json();
  if (!json.prayerTime?.length) throw new Error('No prayerTime array in response');
  return json.prayerTime.map(normalizeRow);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export default function usePrayerTimes() {
  const monthCache = useRef({});     // { "YYYY-MM": normalizedRow[] }
  const zoneRef    = useRef(null);
  const ptRef      = useRef(null);   // today's row — read in ticker to avoid stale closure
  const dayRef     = useRef(klDateKey());

  const [isLoading,           setIsLoading]           = useState(false);
  const [prayerTime,          setPrayerTime]          = useState(null);
  const [hijriDate,           setHijriDate]           = useState('');
  const [gregorianDate,       setGregorianDate]       = useState('');
  const [currentPrayerName,   setCurrentPrayerName]   = useState('--');
  const [currentPrayerTime,   setCurrentPrayerTime]   = useState('--:--');
  const [nextPrayerName,      setNextPrayerName]      = useState('--');
  const [nextPrayerTime,      setNextPrayerTime]      = useState('--:--');
  const [countdown,           setCountdown]           = useState('--:--:--');
  const [currentPrayerIndex,  setCurrentPrayerIndex]  = useState(0);
  const [isBeforeFirstPrayer, setIsBeforeFirstPrayer] = useState(false);
  const [cachedPrayerTimes,   setCachedPrayerTimes]   = useState([]);

  // Sheet navigation state
  const [sheetPrayerTime, setSheetPrayerTime] = useState(null);
  const [sheetDate,       setSheetDate]       = useState('');
  const [sheetHijri,      setSheetHijri]      = useState('');
  const [isLoadingSheet,  setIsLoadingSheet]  = useState(false);

  const refreshCache = useCallback(() => {
    setCachedPrayerTimes(Object.values(monthCache.current).flat());
  }, []);

  const loadMonth = useCallback(async (zoneCode, year, month) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (monthCache.current[key]) return monthCache.current[key];
    const rows = await fetchMonthData(zoneCode, year, month);
    monthCache.current[key] = rows;
    refreshCache();
    return rows;
  }, [refreshCache]);

  // Compute and push current/next prayer + countdown from a prayer row
  const computeCurrentNext = useCallback((pt) => {
    if (!pt) return;
    const now = klTimeParts();
    const nowSecs = now.h * 3600 + now.m * 60 + now.s;
    const prayers = PRAYER_KEYS.map(k => ({ key: k, name: PRAYER_DISPLAY[k], time: pt[k] }));

    let idx = -1;
    for (let i = prayers.length - 1; i >= 0; i--) {
      const s = timeToSecs(prayers[i].time);
      if (s !== -1 && nowSecs >= s) { idx = i; break; }
    }

    const isBefore = idx === -1;
    // Before Imsak: current = Isyak, next = Subuh (skip Imsak per spec)
    const fajrIdx = PRAYER_KEYS.indexOf('fajr');
    if (isBefore) idx = prayers.length - 1;

    const nextIdx = isBefore ? fajrIdx : (idx + 1) % prayers.length;
    const nextSecs = timeToSecs(prayers[nextIdx].time);
    let diffSecs = nextSecs - nowSecs;
    if (diffSecs <= 0) diffSecs += 86400;

    const hh = Math.floor(diffSecs / 3600);
    const mm = Math.floor((diffSecs % 3600) / 60);
    const ss = diffSecs % 60;

    setIsBeforeFirstPrayer(isBefore);
    setCurrentPrayerIndex(idx);
    setCurrentPrayerName(prayers[idx].name);
    setCurrentPrayerTime(prayers[idx].time);
    setNextPrayerName(prayers[nextIdx].name);
    setNextPrayerTime(prayers[nextIdx].time);
    setCountdown(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
  }, []);

  const fetchZone = useCallback(async (zoneCode) => {
    if (!zoneCode) return;
    zoneRef.current = zoneCode;
    setIsLoading(true);
    try {
      const { year, month, day } = klDateParts();
      const rows = await loadMonth(zoneCode, year, month);
      const row = rows[day - 1] || rows[0];
      ptRef.current = row;
      setPrayerTime(row);
      setHijriDate(row.hijri);
      setGregorianDate(row.date);
      setSheetPrayerTime(row);
      setSheetDate(row.date);
      setSheetHijri(row.hijri);
      computeCurrentNext(row);
    } catch (err) {
      console.warn('usePrayerTimes.fetchZone:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [loadMonth, computeCurrentNext]);

  // 1-second ticker — handles countdown and midnight rollover
  useEffect(() => {
    const id = setInterval(() => {
      const today = klDateKey();
      if (today !== dayRef.current) {
        dayRef.current = today;
        if (zoneRef.current) fetchZone(zoneRef.current);
        return;
      }
      computeCurrentNext(ptRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [computeCurrentNext, fetchZone]);

  const fetchForDate = useCallback(async (date) => {
    if (!zoneRef.current) return;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: KL_TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    }).formatToParts(date);
    const get = t => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
    const year = get('year'), month = get('month'), day = get('day');

    setIsLoadingSheet(true);
    try {
      const rows = await loadMonth(zoneRef.current, year, month);
      const row = rows[day - 1] || rows[0];
      setSheetPrayerTime(row);
      setSheetDate(row.date);
      setSheetHijri(row.hijri);
    } catch (err) {
      console.warn('fetchForDate:', err.message);
    } finally {
      setIsLoadingSheet(false);
    }
  }, [loadMonth]);

  return {
    fetch: fetchZone,
    isLoading,
    prayerTime,
    hijriDate,
    gregorianDate,
    currentPrayerName,
    currentPrayerTime,
    nextPrayerName,
    nextPrayerTime,
    countdown,
    currentPrayerIndex,
    isBeforeFirstPrayer,
    cachedPrayerTimes,
    sheetPrayerTime,
    sheetDate,
    sheetHijri,
    isLoadingSheet,
    fetchForDate,
  };
}
