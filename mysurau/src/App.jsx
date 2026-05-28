import { useState, useEffect, useCallback, useRef } from 'react';
import MapView from './components/MapView';
import PrayerTimeBar from './components/PrayerTimeBar';
import SearchPanel from './components/SearchPanel';
import ZoneSelector from './components/ZoneSelector';
import { fetchNearbySurau } from './utils/overpassApi';
import { fetchPrayerTimes } from './utils/prayerApi';
import { reverseGeocode } from './utils/zoneDetection';

const DEFAULT_LOCATION = { lat: 3.139, lon: 101.6869 }; // Kuala Lumpur

export default function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_LOCATION);
  const [locationName, setLocationName] = useState('Mencari lokasi…');
  const [zone, setZone] = useState('WLY01');
  const [zoneName, setZoneName] = useState('Kuala Lumpur');

  const [prayerTimes, setPrayerTimes] = useState(null);
  const [surauList, setSurauList] = useState([]);

  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingSurau, setLoadingSurau] = useState(false);


  const [selectedSurau, setSelectedSurau] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [error, setError] = useState(null);

  const surauFetchRef = useRef(null);

  /* ─── Load prayer times ─── */
  const loadPrayerTimes = useCallback(async (zoneCode) => {
    try {
      const times = await fetchPrayerTimes(zoneCode);
      setPrayerTimes(times);
    } catch (err) {
      console.error('Prayer times error:', err);
    }
  }, []);

  /* ─── Load nearby surau ─── */
  const loadSurau = useCallback(async (lat, lon, attempt = 1) => {
    // Cancel any previous fetch
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
      console.error(`Surau fetch error (attempt ${attempt}):`, err);
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

  /* ─── Init: detect location ─── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationName('Kuala Lumpur');
      setLoadingLocation(false);
      loadSurau(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      loadPrayerTimes('WLY01');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setMapCenter(coords);
        setLoadingLocation(false);

        // Reverse geocode → zone
        const geo = await reverseGeocode(coords.lat, coords.lon);
        if (geo) {
          setLocationName(geo.displayName);
          setZone(geo.zone);
          setZoneName(geo.zoneName);
          loadPrayerTimes(geo.zone);
        } else {
          loadPrayerTimes('WLY01');
        }

        loadSurau(coords.lat, coords.lon);
      },
      (err) => {
        console.warn('Geolocation denied:', err.message);
        setLocationName('Kuala Lumpur');
        setLoadingLocation(false);
        loadSurau(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
        loadPrayerTimes('WLY01');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, [loadSurau, loadPrayerTimes]);

  /* ─── Handlers ─── */
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setMapCenter({ ...coords, _ts: Date.now() }); // force recenter
        loadSurau(coords.lat, coords.lon);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleRefresh = () => {
    const loc = userLocation || DEFAULT_LOCATION;
    loadSurau(loc.lat, loc.lon);
    loadPrayerTimes(zone);
  };

  const handleZoneChange = (newZone, newZoneName) => {
    setZone(newZone);
    setZoneName(newZoneName);
    loadPrayerTimes(newZone);
  };

  /* ─── Loading splash ─── */
  if (loadingLocation) {
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
      {/* Header: prayer times */}
      <PrayerTimeBar
        prayerTimes={prayerTimes}
        locationName={locationName}
        zone={zoneName || zone}
        zoneCode={zone}
        onZoneClick={() => setShowZoneSelector(true)}
      />

      {/* Map */}
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

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
          <button className="error-banner__close" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Bottom search panel */}
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

      {/* Zone selector modal */}
      {showZoneSelector && (
        <ZoneSelector
          currentZone={zone}
          onSelect={handleZoneChange}
          onClose={() => setShowZoneSelector(false)}
        />
      )}
    </div>
  );
}
