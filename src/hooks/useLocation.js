import { useState, useCallback, useEffect } from 'react';
import { reverseGeocode } from '../utils/zoneDetection';

const DEFAULT_LOCATION_NAME = 'Kuala Lumpur';
const DEFAULT_ZONE          = 'WLY01';

export default function useLocation() {
  const [location,     setLocation]     = useState(null);   // { lat, lng }
  const [locationName, setLocationName] = useState('');     // empty string = skeleton state
  const [stateName,    setStateName]    = useState('');
  const [zoneCode,     setZoneCode]     = useState('');
  const [isLocating,   setIsLocating]   = useState(false);

  const applyDefault = useCallback(() => {
    setLocationName(DEFAULT_LOCATION_NAME);
    setZoneCode(DEFAULT_ZONE);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      applyDefault();
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        setIsLocating(false);

        try {
          // reverseGeocode(lat, lon) — "lon" is the parameter name but any value works
          const geo = await reverseGeocode(coords.lat, coords.lng);
          if (geo) {
            setLocationName(geo.displayName);
            setStateName(geo.zoneName);
            setZoneCode(geo.zone);
          } else {
            applyDefault();
          }
        } catch {
          applyDefault();
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.code, err.message);
        setIsLocating(false);
        applyDefault();
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  }, [applyDefault]);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  return { location, locationName, stateName, zoneCode, isLocating, requestLocation };
}
