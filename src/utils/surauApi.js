import { supabase } from '../lib/supabase';

/* ─── In-memory cache (survives re-renders, cleared on explicit refresh) ─── */
let cachedPins = null;

export async function fetchSurauPins(userLat = null, userLon = null, { bust = false } = {}) {
  if (bust) cachedPins = null;

  if (!cachedPins) {
    const { data, error } = await supabase.rpc('surau_pins');
    if (error) throw new Error(error.message);

    cachedPins = (data || [])
      .filter(row => row.approved !== false)
      .map(row => ({
        id: row.id,
        name: row.name,
        lat: row.latitude,
        lon: row.longitude,
        category: normaliseCategory(row.category),
        address: row.address || null,
        city: row.city || null,
        status: row.status ? row.status.toLowerCase().replace(/\s+/g, '_') : null,
        friday_prayer: row.friday_prayer ?? false,
        public_access: row.public_access ?? true,
      }));
  }

  if (userLat != null && userLon != null) {
    return cachedPins.map(pin => ({
      ...pin,
      distance: haversine(userLat, userLon, pin.lat, pin.lon),
    }));
  }

  return cachedPins;
}

export async function fetchSurauImages(surauId) {
  const { data, error } = await supabase
    .from('surau_images')
    .select('id, url, position')
    .eq('surau_id', surauId)
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

function normaliseCategory(cat) {
  if (!cat) return 'surau';
  return cat.toLowerCase().replace(/\s+/g, '_');
}

export function getCategoryColor(category) {
  if (category === 'mosque') return 'rgb(51,179,77)';
  if (['petrol_station', 'shopping_mall', 'public_building', 'rnr'].includes(category)) return '#111111';
  return 'rgb(0,140,179)';
}

export function getCategoryLabel(category) {
  const map = {
    surau: 'Residential surau',
    mosque: 'Mosque',
    petrol_station: 'Petrol station',
    shopping_mall: 'Shopping mall',
    public_building: 'Public building',
    rnr: 'RNR',
  };
  if (map[category]) return map[category];
  if (!category) return 'Surau';
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
}

export function formatDistance(metres) {
  if (metres == null) return null;
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
