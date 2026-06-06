import { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView';
import Hero from './components/Hero';
import PrayerPill from './components/PrayerPill';
import PrayerTimesSheet from './components/PrayerTimesSheet';
import DownloadAppSheet from './components/DownloadAppSheet';
import BottomPanel from './components/BottomPanel';
import MenuDrawer from './components/MenuDrawer';
import useLocation from './hooks/useLocation';
import usePrayerTimes from './hooks/usePrayerTimes';
import useSuraus from './hooks/useSuraus';

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
  const [searchQuery,      setSearchQuery]      = useState('');
  const [menuOpen,         setMenuOpen]         = useState(false);
  const [prayerSheetOpen,  setPrayerSheetOpen]  = useState(false);
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false);
  const promptDownload = useCallback(() => setDownloadSheetOpen(true), []);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleLocateMe     = useCallback(() => loc.requestLocation(), [loc]);
  const handleLongPressMap = useCallback(() => promptDownload(), [promptDownload]);
  const handleSelectSurau  = useCallback((surau) => {
    console.warn('[App] pin/card tap → SurauDetailSheet (Slice 7)', surau.name);
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
      <MenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPromptDownload={promptDownload}
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
