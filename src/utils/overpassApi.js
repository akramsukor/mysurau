/**
 * Queries the Overpass API (OpenStreetMap) for mosques, surau, and prayer rooms.
 */

const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

/**
 * Fetch prayer facilities near a coordinate within a given radius (metres).
 * Tries each Overpass mirror in order until one succeeds.
 */
export async function fetchNearbySurau(lat, lon, radius = 5000) {
  const query = buildQuery(lat, lon, radius);
  const body = new URLSearchParams({ data: query });

  let lastError;
  for (const endpoint of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      return parseElements(json.elements || [], lat, lon);
    } catch (err) {
      console.warn(`Overpass mirror failed (${endpoint}):`, err.message);
      lastError = err;
    }
  }

  throw lastError;
}

function buildQuery(lat, lon, radius) {
  return `
[out:json][timeout:25];
(
  node["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lon});
  way["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lon});
  relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lon});
  node["amenity"="prayer_room"](around:${radius},${lat},${lon});
  way["amenity"="prayer_room"](around:${radius},${lat},${lon});
  node["building"="mosque"](around:${radius},${lat},${lon});
  way["building"="mosque"](around:${radius},${lat},${lon});
  node["amenity"="fuel"]["prayer_room"="yes"](around:${radius},${lat},${lon});
  way["amenity"="fuel"]["prayer_room"="yes"](around:${radius},${lat},${lon});
  node["amenity"="fuel"]["toilets:prayer_room"="yes"](around:${radius},${lat},${lon});
  way["amenity"="fuel"]["toilets:prayer_room"="yes"](around:${radius},${lat},${lon});
  node["amenity"="fuel"]["religion"="muslim"](around:${radius},${lat},${lon});
  way["amenity"="fuel"]["religion"="muslim"](around:${radius},${lat},${lon});
  node["amenity"="fuel"]["surau"="yes"](around:${radius},${lat},${lon});
  way["amenity"="fuel"]["surau"="yes"](around:${radius},${lat},${lon});
);
out body center;
  `.trim();
}

function parseElements(elements, userLat, userLon) {
  const results = [];

  for (const el of elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat == null || elLon == null) continue;

    const tags = el.tags || {};
    const name =
      tags['name:ms'] ||
      tags.name ||
      tags['name:en'] ||
      inferName(tags);

    if (!name) continue; // skip unnamed

    const category = categorise(tags);
    const distance = haversine(userLat, userLon, elLat, elLon);

    results.push({
      id: `${el.type}-${el.id}`,
      lat: elLat,
      lon: elLon,
      name,
      category,
      amenity: tags.amenity,
      level: tags.level || tags.floor || null,   // floor level in a building
      building: tags['addr:building'] || tags['located_in'] || null,
      address: buildAddress(tags),
      openingHours: tags.opening_hours || null,
      wheelchair: tags.wheelchair || null,
      distance, // metres
    });
  }

  // Sort by distance
  results.sort((a, b) => a.distance - b.distance);
  return results;
}

const PETROL_BRANDS = ['petronas', 'shell', 'petron', 'caltex', 'bhpetrol', 'bn petrol', 'esso', 'mobil'];

function categorise(tags) {
  const amenity = tags.amenity || '';
  const building = tags.building || '';
  const worship = tags.place_of_worship || '';
  const name = (tags['name:ms'] || tags.name || tags['name:en'] || '').toLowerCase();

  const isPetrol =
    amenity === 'fuel' ||
    tags.type === 'petrol_station' ||
    tags['fuel:station'] === 'yes' ||
    PETROL_BRANDS.some((brand) => name.includes(brand));

  if (isPetrol) {
    return 'petrol';
  }
  if (building === 'mosque' || worship === 'mosque' || name.includes('masjid')) {
    return 'masjid';
  }
  if (
    amenity === 'prayer_room' ||
    worship === 'musalla' ||
    worship === 'musolla' ||
    name.includes('surau') ||
    name.includes('musolla') ||
    name.includes('musalla') ||
    name.includes('prayer room')
  ) {
    return 'surau';
  }
  return 'masjid'; // default for place_of_worship + religion=muslim
}

function inferName(tags) {
  const worship = tags.place_of_worship || '';
  if (worship === 'mosque') return 'Masjid';
  if (worship === 'musalla' || worship === 'musolla') return 'Surau';
  if (tags.amenity === 'prayer_room') return 'Prayer Room / Musolla';
  if (tags.amenity === 'fuel') return 'Stesen Minyak (Ada Surau)';
  return null;
}

function buildAddress(tags) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:postcode'],
    tags['addr:state'],
  ].filter(Boolean);
  return parts.join(', ') || null;
}

/** Haversine distance in metres */
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

/** Format distance for display */
export function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
