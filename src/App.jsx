import { useState, useEffect, useCallback, useRef } from 'react';
import MapView from './components/MapView';
import SearchPanel from './components/SearchPanel';
import ZoneSelector from './components/ZoneSelector';
import Hero from './components/Hero';
import PrayerPill from './components/PrayerPill';
import PrayerTimesSheet from './components/PrayerTimesSheet';
import useLocation from './hooks/useLocation';
import usePrayerTimes from './hooks/usePrayerTimes';
import { fetchNearbySurau } from './utils/overpassApi';
import { reverseGeocode } from './utils/zoneDetection';

const DEFAULT_LOCATION = { lat: 3.139, lon: 101.6869 };

export default function App() {
  // ── New hooks (Slice 2) ──────────────────────────────────────────
  const loc    = useLocation();
  const prayer = usePrayerTimes();

  // Fetch prayer times whenever the zone resolves
  useEffect(() => {
    if (loc.zoneCode) prayer.fetch(loc.zoneCode);
  }, [loc.zoneCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legacy map / surau state (Slice 3 will move this to useSuraus) ──
  const [mapCenter,    setMapCenter]    = useState(DEFAULT_LOCATION);
  const [userLocation, setUserLocation] = useState(null);
  const [surauList,    setSurauList]    = useState([]);
  const [loadingSurau, setLoadingSurau] = useState(false);
  const [selectedSurau, setSelectedSurau] = useState(null);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterType,   setFilterType]   = useState('all');
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [error,        setError]        = useState(null);

  const surauFetchRef = useRef(null);

  // Keep map centre in sync with the location hook
  useEffect(() => {
    if (loc.location) {
      setUserLocation({ lat: loc.location.lat, lon: loc.location.lng });
      setMapCenter(prev => ({
        lat: loc.location.lat,
        lon: loc.location.lng,
        _ts: prev._ts, // preserve recenter trigger
      }));
    }
  }, [loc.location]);

  const loadSurau = useCallback(async (lat, lon, attempt = 1) => {
    if (surauFetchRef.current) surauFetchRef.current = false;
    const token = {};
    surauFetchRef.current = token;

    setLoadingSurau(true);
    setError(null);
    try {
      const results = await fetchNearbySurau(lat, lon, 5000);
      if (surauFetchRef.current === token) {
        setSurauList(results);
        setLoadingSurau(false);
      }
    } catch (err) {
      if (surauFetchRef.current === token) {
        if (attempt < 3) {
          setTimeout(() => loadSurau(lat, lon, attempt + 1), attempt * 3000);
        } else {
          setLoadingSurau(false);
          setError('Gagal memuatkan surau. Server mungkin sibuk — cuba lagi.');
        }
      }
    }
  }, []);

  // Load suraus when location resolves
  useEffect(() => {
    if (loc.location) {
      loadSurau(loc.location.lat, loc.location.lng);
    } else if (!loc.isLocating) {
      // Geolocation denied/unavailable — load for default KL
      loadSurau(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    }
  }, [loc.location, loc.isLocating]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLocateMe = useCallback(() => {
    loc.requestLocation();
    setLocationError(null);
  }, [loc]);

  const handleRefresh = useCallback(() => {
    const lat = loc.location?.lat ?? DEFAULT_LOCATION.lat;
    const lon = loc.location?.lng ?? DEFAULT_LOCATION.lon;
    loadSurau(lat, lon);
    if (loc.zoneCode) prayer.fetch(loc.zoneCode);
  }, [loc, loadSurau, prayer]);

  const handleZoneChange = useCallback((newZone) => {
    prayer.fetch(newZone);
  }, [prayer]);

  // ── Prayer sheet ──────────────────────────────────────────────────
  const [prayerSheetOpen, setPrayerSheetOpen] = useState(false);

  // ── Splash while waiting for location ──────────────────────────────
  if (!loc.locationName) {
    return (
      <div className="splash">
        <div className="splash__content">
          <div className="splash__icon">🕌</div>
          <h1 className="splash__title">MySurau</h1>
          <p className="splash__subtitle">Mencari lokasi dan surau berdekatan…</p>
          <div className="splash__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* ── Teal hero header ── */}
      <Hero
        locationName={loc.locationName}
        hijriDate={prayer.hijriDate}
        onRefresh={handleLocateMe}
        onOpenMenu={() => console.warn('Menu drawer — Slice 6')}
      />

      {/* ── Prayer pill (overlaps hero/map boundary) ── */}
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
          surauList={surauList}
          selectedSurau={selectedSurau}
          onSurauSelect={setSelectedSurau}
          onRefresh={handleRefresh}
          onLocateMe={handleLocateMe}
        />
      </div>

      {/* ── Location error banner ── */}
      {locationError && (
        <div className="location-banner">
          <span>
            {locationError === 'denied'
              ? 'Akses lokasi ditolak. Benarkan akses lokasi dalam tetapan pelayar anda.'
              : locationError === 'unavailable'
              ? 'Lokasi tidak dapat dikesan. Menunjukkan Kuala Lumpur sebagai lalai.'
              : 'Masa mencari lokasi tamat. Tekan butang lokasi untuk cuba semula.'}
          </span>
          <button className="error-banner__close" onClick={() => setLocationError(null)}>✕</button>
        </div>
      )}

      {/* ── Surau fetch error banner ── */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button className="error-banner__close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ── Bottom search panel ── */}
      <SearchPanel
        surauList={surauList}
        userLocation={userLocation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterType={filterType}
        onFilterChange={setFilterType}
        selectedSurau={selectedSurau}
        onSurauSelect={setSelectedSurau}
        loading={loadingSurau}
      />

      {/* ── Zone selector (legacy, still used by SearchPanel area) ── */}
      {showZoneSelector && (
        <ZoneSelector
          currentZone={loc.zoneCode}
          onSelect={handleZoneChange}
          onClose={() => setShowZoneSelector(false)}
        />
      )}

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
