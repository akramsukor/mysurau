import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchNearbySurau } from '../utils/overpassApi';

const REFETCH_THRESHOLD_M = 250;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fromOSM(s) {
  return {
    id:            s.id,
    source:        'osm',
    name:          s.name,
    lat:           s.lat,
    lng:           s.lon,
    category:      s.category,
    address:       s.address,
    status:        null,
    friday_prayer: null,
    public_access: null,
  };
}

function fromSupabase(s) {
  return {
    id:            `sb_${s.id}`,
    source:        'supabase',
    name:          s.name,
    lat:           s.latitude,
    lng:           s.longitude,
    category:      s.category,
    address:       s.address,
    status:        s.status,
    friday_prayer: s.friday_prayer,
    public_access: s.public_access,
  };
}

export default function useSuraus() {
  const [suraus,          setSuraus]          = useState([]);
  const [isLoadingSuraus, setIsLoadingSuraus] = useState(false);
  const [error,           setError]           = useState(null);
  const prevLocRef  = useRef(null);
  const activeToken = useRef(null); // cancels stale refreshes

  const refresh = useCallback(async (lat, lng) => {
    if (prevLocRef.current) {
      const dist = haversine(prevLocRef.current.lat, prevLocRef.current.lng, lat, lng);
      if (dist < REFETCH_THRESHOLD_M) return;
    }
    prevLocRef.current = { lat, lng };

    // Token lets us discard results from a superseded refresh
    const token = Symbol();
    activeToken.current = token;

    setIsLoadingSuraus(true);
    setError(null);
    setSuraus([]);

    // Append pins as each source resolves — Supabase will appear first
    // (Overpass mirrors can take 10–35 s; we don't block on them)
    const append = (newPins) => {
      if (activeToken.current !== token) return; // stale
      if (newPins.length === 0) return;
      setSuraus(prev => [...prev, ...newPins]);
    };

    const osmPromise = fetchNearbySurau(lat, lng, 5000)
      .then(results => append(results.map(fromOSM)))
      .catch(err => console.warn('useSuraus OSM:', err.message));

    const sbPromise = supabase.rpc('surau_pins')
      .then(({ data, error: sbErr }) => {
        if (sbErr) throw sbErr;
        append((data ?? []).map(fromSupabase));
      })
      .catch(err => console.warn('useSuraus Supabase:', err.message));

    await Promise.allSettled([osmPromise, sbPromise]);

    if (activeToken.current === token) setIsLoadingSuraus(false);
  }, []);

  return { suraus, isLoadingSuraus, error, refresh };
}
