import { useState, useEffect, useCallback, useRef } from 'react';
import MapView from './components/MapView';
import PrayerTimeBar from './components/PrayerTimeBar';

import SurauModal from './components/SurauModal';
import AppPromoSheet from './components/AppPromoSheet';
import { fetchSurauPins } from './utils/surauApi';
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
  const [locationError, setLocationError] = useState(null);

  const [selectedSurau, setSelectedSurau] = useState(null);
  const [error, setError] = useState(null);

  // Counter-based cancellation: only the latest call updates state
  const loadCountRef = useRef(0);

  /* ─── Load prayer times ─── */
  const loadPrayerTimes = useCallback(async (zoneCode) => {
    try {
      const times = await fetchPrayerTimes(zoneCode);
      setPrayerTimes(times);
    } catch (err) {
      console.error('Prayer times error:', err);
    }
  }, []);

  /* ─── Load surau from Supabase ─── */
  const loadSurau = useCallback(async (lat, lon, bust = false) => {
    const myCount = ++loadCountRef.current;
    setLoadingSurau(true);
    setError(null);
    try {
      const pins = await fetchSurauPins(lat, lon, { bust });
      if (loadCountRef.current === myCount) {
        setSurauList(pins);
        setLoadingSurau(false);
      }
    } catch (err) {
      console.error('Surau fetch error:', err);
      if (loadCountRef.current === myCount) {
        setLoadingSurau(false);
        setError('Gagal memuatkan surau. Cuba lagi.');
      }
    }
  }, []);

  /* ─── Init: fetch surau immediately, then update with location ─── */
  useEffect(() => {
    loadSurau(null, null);

    if (!navigator.geolocation) {
      setLocationName('Kuala Lumpur');
      setLoadingLocation(false);
      loadPrayerTimes('WLY01');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setMapCenter(coords);
        setLoadingLocation(false);

        const geo = await reverseGeocode(coords.lat, coords.lon);
        if (geo) {
          setLocationName(geo.displayName);
          setZone(geo.zone);
          setZoneName(geo.zoneName);
          loadPrayerTimes(geo.zone);
        } else {
          loadPrayerTimes('WLY01');
        }

        // Re-run with location to add distances (uses cached pins — fast)
        loadSurau(coords.lat, coords.lon);
      },
      (err) => {
        console.warn('Geolocation error:', err.code, err.message);
        if (err.code === 1) setLocationError('denied');
        else if (err.code === 2) setLocationError('unavailable');
        else setLocationError('timeout');
        setLocationName('Kuala Lumpur');
        setLoadingLocation(false);
        loadPrayerTimes('WLY01');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  }, [loadSurau, loadPrayerTimes]);

  /* ─── Handlers ─── */
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setMapCenter({ ...coords, _ts: Date.now() });
        setLocationError(null);
        loadSurau(coords.lat, coords.lon);
      },
      (err) => {
        if (err.code === 1) setLocationError('denied');
        else if (err.code === 2) setLocationError('unavailable');
        else setLocationError('timeout');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleRefresh = () => {
    const lat = userLocation?.lat ?? DEFAULT_LOCATION.lat;
    const lon = userLocation?.lon ?? DEFAULT_LOCATION.lon;
    loadSurau(lat, lon, true); // bust cache on manual refresh
    loadPrayerTimes(zone);
  };

  /* ─── Loading splash ─── */
  if (loadingLocation) {
    return (
      <div className="splash">
        <div className="splash__content">
          <img src="/icon.png" alt="MySurau" className="splash__icon" />
          <h1 className="splash__title">MySurau</h1>
          <p className="splash__subtitle">Finding your location and nearby surau…</p>
          <div className="splash__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Top app header */}
      <header className="app-header">
        <div className="app-header__brand">
          <img src="/icon.png" alt="MySurau" className="app-header__logo" />
          <div>
            <div className="app-header__name">
              MySurau <span className="app-header__stars">★★★★★</span>
            </div>
            <div className="app-header__tagline">Find nearest surau</div>
          </div>
        </div>
        <div className="app-header__badges">
          <a href="#" target="_blank" rel="noopener noreferrer">
            <img src="/badge-google-play.svg" alt="Get it on Google Play" className="store-badge-img" />
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer">
            <img src="/badge-app-store.svg" alt="Download on the App Store" className="store-badge-img" />
          </a>
        </div>
      </header>

      {/* Map + overlays */}
      <div className="app__map">
        <PrayerTimeBar
          prayerTimes={prayerTimes}
          locationName={locationName}
          zone={zoneName || zone}
          zoneCode={zone}
          onRefresh={handleRefresh}
        />

        <MapView
          center={mapCenter}
          userLocation={userLocation}
          surauList={surauList}
          selectedSurau={selectedSurau}
          onSurauSelect={setSelectedSurau}
          onLocateMe={handleLocateMe}
        />

        {locationError && (
          <div className="location-banner">
            <span>
              {locationError === 'denied'
                ? 'Akses lokasi ditolak. Benarkan akses lokasi dalam tetapan pelayar anda, kemudian tekan 📍.'
                : locationError === 'unavailable'
                ? 'Lokasi tidak dapat dikesan. Menunjukkan Kuala Lumpur sebagai lalai.'
                : 'Masa mencari lokasi tamat. Tekan 📍 untuk cuba semula.'}
            </span>
            <button className="error-banner__close" onClick={() => setLocationError(null)}>✕</button>
          </div>
        )}

        {error && (
          <div className="error-banner">
            ⚠️ {error}
            <button className="error-banner__close" onClick={() => setError(null)}>✕</button>
          </div>
        )}
      </div>

      {/* Mobile-only store badges — shown at bottom when header badges are hidden */}
      <div className="store-badges-mobile">
        <div className="store-badges-mobile__row">
          <a href="#" target="_blank" rel="noopener noreferrer">
            <img src="/badge-google-play.svg" alt="Get it on Google Play" className="store-badge-img" />
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer">
            <img src="/badge-app-store.svg" alt="Download on the App Store" className="store-badge-img" />
          </a>
        </div>
      </div>

      {/* App promo sheet — shown once per session */}
      <AppPromoSheet />

      {/* Surau detail modal */}
      {selectedSurau && (
        <SurauModal
          surau={selectedSurau}
          userLocation={userLocation}
          onClose={() => setSelectedSurau(null)}
        />
      )}
    </div>
  );
}
