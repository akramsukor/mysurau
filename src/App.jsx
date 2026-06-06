import { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView';
import Hero from './components/Hero';
import PrayerPill from './components/PrayerPill';
import PrayerTimesSheet from './components/PrayerTimesSheet';
import DownloadAppSheet from './components/DownloadAppSheet';
import BottomPanel from './components/BottomPanel';
import MenuDrawer from './components/MenuDrawer';
import SurauDetailSheet from './components/SurauDetailSheet';
import useLocation from './hooks/useLocation';
import usePrayerTimes from './hooks/usePrayerTimes';
import useSuraus from './hooks/useSuraus';
import usePrayerNotifications from './hooks/usePrayerNotifications';

const DEFAULT_LOCATION = { lat: 3.139, lon: 101.6869 };

export default function App() {
  // ── Hooks ────────────────────────────────────────────────────────
  const loc    = useLocation();
  const prayer = usePrayerTimes();
  const suraus = useSuraus();

  useEffect(() => {
    if (loc.zoneCode) prayer.fetch(loc.zoneCode);
  }, [loc.zoneCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loc.location) {
      suraus.refresh(loc.location.lat, loc.location.lng);
    } else if (!loc.isLocating) {
      suraus.refresh(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    }
  }, [loc.location, loc.isLocating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI state ─────────────────────────────────────────────────────
  // Lifted from MenuDrawer so usePrayerNotifications can read the same value.
  // Default false on web — honest: we don't request notification permission unprompted.
  const [prayerAlertEnabled, setPrayerAlertEnabled] = useState(() => {
    try { return localStorage.getItem('prayer_alert_enabled') === 'true'; }
    catch { return false; }
  });

  const handleAlertChange = useCallback((val) => {
    setPrayerAlertEnabled(val);
    try { localStorage.setItem('prayer_alert_enabled', String(val)); }
    catch {}
  }, []);

  usePrayerNotifications({
    enabled:           prayerAlertEnabled,
    cachedPrayerTimes: prayer.cachedPrayerTimes,
    locationName:      loc.locationName,
  });

  const [selectedSurau,    setSelectedSurau]    = useState(null);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [menuOpen,         setMenuOpen]         = useState(false);
  const [prayerSheetOpen,  setPrayerSheetOpen]  = useState(false);
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false);
  const promptDownload = useCallback(() => setDownloadSheetOpen(true), []);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleLocateMe     = useCallback(() => loc.requestLocation(), [loc]);
  const handleLongPressMap = useCallback(() => promptDownload(), [promptDownload]);
  const handleSelectSurau  = useCallback((surau) => {
    setSelectedSurau(surau);
  }, []);

  // ── Splash ───────────────────────────────────────────────────────
  if (!loc.locationName) {
    return (
      <div className="splash">
        <div className="splash__content">
          <div className="splash__icon">🕌</div>
          <h1 className="splash__title">MySurau</h1>
          <p className="splash__subtitle">Finding your location…</p>
          <div className="splash__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* ── Teal hero ── */}
      <Hero
        locationName={loc.locationName}
        hijriDate={prayer.hijriDate}
        onRefresh={handleLocateMe}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {/* ── Prayer pill ── */}
      <PrayerPill
        currentPrayerName={prayer.currentPrayerName}
        currentPrayerTime={prayer.currentPrayerTime}
        nextPrayerName={prayer.nextPrayerName}
        nextPrayerTime={prayer.nextPrayerTime}
        countdown={prayer.countdown}
        onOpenPrayerSheet={() => setPrayerSheetOpen(true)}
      />

      {/* ── Map (fills remaining space, panels overlay it) ── */}
      <div className="app__map">
        <MapView
          center={loc.location
            ? { lat: loc.location.lat, lon: loc.location.lng }
            : DEFAULT_LOCATION}
          userLocation={loc.location
            ? { lat: loc.location.lat, lon: loc.location.lng }
            : null}
          suraus={suraus.suraus}
          onSelectSurau={handleSelectSurau}
          onLongPressMap={handleLongPressMap}
          onLocateMe={handleLocateMe}
        />
      </div>

      {/* ── Bottom panel: search + surau cards ── */}
      <BottomPanel
        suraus={suraus.suraus}
        userLocation={loc.location}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectSurau={handleSelectSurau}
        loading={suraus.isLoadingSuraus}
      />

      {/* ── Sheets ── */}
      <SurauDetailSheet
        open={!!selectedSurau}
        surau={selectedSurau}
        onClose={() => setSelectedSurau(null)}
        onPromptDownload={promptDownload}
      />

      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPromptDownload={promptDownload}
        alertOn={prayerAlertEnabled}
        onAlertChange={handleAlertChange}
      />

      <DownloadAppSheet
        open={downloadSheetOpen}
        onClose={() => setDownloadSheetOpen(false)}
      />

      <PrayerTimesSheet
        open={prayerSheetOpen}
        onClose={() => setPrayerSheetOpen(false)}
        sheetPrayerTime={prayer.sheetPrayerTime}
        sheetHijri={prayer.sheetHijri}
        currentPrayerIndex={prayer.currentPrayerIndex}
        isLoadingSheet={prayer.isLoadingSheet}
        fetchForDate={prayer.fetchForDate}
      />
    </div>
  );
}
