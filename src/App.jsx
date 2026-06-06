import { useState, useEffect, useCallback } from 'react';
import MapView from './components/MapView';
import SearchPanel from './components/SearchPanel';
import ZoneSelector from './components/ZoneSelector';
import Hero from './components/Hero';
import PrayerPill from './components/PrayerPill';
import PrayerTimesSheet from './components/PrayerTimesSheet';
import DownloadAppSheet from './components/DownloadAppSheet';
import useLocation from './hooks/useLocation';
import usePrayerTimes from './hooks/usePrayerTimes';
import useSuraus from './hooks/useSuraus';

const DEFAULT_LOCATION = { lat: 3.139, lon: 101.6869 };

export default function App() {
  // ── Hooks ────────────────────────────────────────────────────────
  const loc    = useLocation();
  const prayer = usePrayerTimes();
  const suraus = useSuraus();

  // Fetch prayer times when zone resolves
  useEffect(() => {
    if (loc.zoneCode) prayer.fetch(loc.zoneCode);
  }, [loc.zoneCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load suraus when location resolves or falls back to default
  useEffect(() => {
    if (loc.location) {
      suraus.refresh(loc.location.lat, loc.location.lng);
    } else if (!loc.isLocating) {
      suraus.refresh(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    }
  }, [loc.location, loc.isLocating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legacy UI state (SearchPanel / ZoneSelector — rebuilt in Slice 4) ──
  const [selectedSurau,    setSelectedSurau]    = useState(null);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [filterType,       setFilterType]       = useState('all');
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [prayerSheetOpen,  setPrayerSheetOpen]  = useState(false);
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false);
  const promptDownload = useCallback(() => setDownloadSheetOpen(true), []);

  // Derive mapCenter + userLocation from the location hook
  const mapCenter = loc.location
    ? { lat: loc.location.lat, lon: loc.location.lng }
    : DEFAULT_LOCATION;

  const userLocation = loc.location
    ? { lat: loc.location.lat, lon: loc.location.lng }
    : null;

  // ── Handlers ─────────────────────────────────────────────────────
  const handleLocateMe = useCallback(() => {
    loc.requestLocation();
  }, [loc]);

  const handleZoneChange = useCallback((newZone) => {
    prayer.fetch(newZone);
  }, [prayer]);

  const handleSelectSurau = useCallback((surau) => {
    console.warn('[App] pin tap → SurauDetailSheet (Slice 7)', surau.name);
    setSelectedSurau(surau);
  }, []);

  const handleLongPressMap = useCallback(() => {
    promptDownload();
  }, [promptDownload]);

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
        onOpenMenu={() => console.warn('[App] Menu drawer — Slice 6')}
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

      {/* ── Map ── */}
      <div className="app__map">
        <MapView
          center={mapCenter}
          userLocation={userLocation}
          suraus={suraus.suraus}
          onSelectSurau={handleSelectSurau}
          onLongPressMap={handleLongPressMap}
          onLocateMe={handleLocateMe}
        />
      </div>

      {/* ── Surau error banner ── */}
      {suraus.error && (
        <div className="error-banner">
          ⚠️ {suraus.error}
        </div>
      )}

      {/* ── Bottom search panel (legacy, rebuilt in Slice 4) ── */}
      <SearchPanel
        surauList={suraus.suraus}
        userLocation={userLocation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterType={filterType}
        onFilterChange={setFilterType}
        selectedSurau={selectedSurau}
        onSurauSelect={handleSelectSurau}
        loading={suraus.isLoadingSuraus}
      />

      {/* ── Zone selector (legacy) ── */}
      {showZoneSelector && (
        <ZoneSelector
          currentZone={loc.zoneCode}
          onSelect={handleZoneChange}
          onClose={() => setShowZoneSelector(false)}
        />
      )}

      {/* ── Download app sheet (long-press / write-intent actions) ── */}
      <DownloadAppSheet
        open={downloadSheetOpen}
        onClose={() => setDownloadSheetOpen(false)}
      />

      {/* ── Prayer times sheet ── */}
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
