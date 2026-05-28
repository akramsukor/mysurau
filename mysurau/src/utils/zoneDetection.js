/**
 * JAKIM prayer time zone detection via reverse geocoding (Nominatim).
 * Zone codes are based on the official e-Solat JAKIM zone list.
 */

// Comprehensive JAKIM zone lookup by state + district
const ZONE_MAP = {
  // Wilayah Persekutuan
  'Kuala Lumpur': { zone: 'WLY01', name: 'Kuala Lumpur' },
  'Putrajaya': { zone: 'WLY02', name: 'Putrajaya' },
  'Labuan': { zone: 'WLY03', name: 'Labuan' },

  // Perlis
  'Perlis': { zone: 'PLS01', name: 'Perlis' },

  // Kedah (default to KDH01; major zones below)
  'Kedah': { zone: 'KDH01', name: 'Kedah' },

  // Pulau Pinang
  'Pulau Pinang': { zone: 'PNG01', name: 'Pulau Pinang' },
  'Penang': { zone: 'PNG01', name: 'Pulau Pinang' },
  'Georgetown': { zone: 'PNG01', name: 'Pulau Pinang' },

  // Perak (default KDH01)
  'Perak': { zone: 'PRK01', name: 'Perak' },

  // Selangor — district-level is handled separately
  'Selangor': { zone: 'SGR01', name: 'Selangor' },

  // Negeri Sembilan
  'Negeri Sembilan': { zone: 'NGS01', name: 'Negeri Sembilan' },

  // Melaka
  'Melaka': { zone: 'MLK01', name: 'Melaka' },
  'Malacca': { zone: 'MLK01', name: 'Melaka' },

  // Johor
  'Johor': { zone: 'JHR01', name: 'Johor' },

  // Pahang
  'Pahang': { zone: 'PHG01', name: 'Pahang' },

  // Terengganu
  'Terengganu': { zone: 'TRG01', name: 'Terengganu' },
  'Trengganu': { zone: 'TRG01', name: 'Terengganu' },

  // Kelantan
  'Kelantan': { zone: 'KTN01', name: 'Kelantan' },

  // Sabah
  'Sabah': { zone: 'SBH01', name: 'Sabah' },

  // Sarawak
  'Sarawak': { zone: 'SWK01', name: 'Sarawak' },
};

// Selangor district-level mapping (Overrides state default)
const SELANGOR_DISTRICTS = {
  // SGR01 – Gombak, Hulu Langat, Hulu Selangor, Rawang, Kuala Selangor, Sabak Bernam, Sepang
  'Gombak': 'SGR01',
  'Hulu Langat': 'SGR01',
  'Hulu Selangor': 'SGR01',
  'Rawang': 'SGR01',
  'Kuala Selangor': 'SGR01',
  'Sabak Bernam': 'SGR01',
  'Sepang': 'SGR01',
  'Ampang': 'SGR01',
  'Kajang': 'SGR01',
  'Cheras': 'SGR01',
  'Serdang': 'SGR01',
  'Bangi': 'SGR01',
  'Semenyih': 'SGR01',
  'Beranang': 'SGR01',

  // SGR02 – Petaling, Klang, Shah Alam, Kuala Langat
  'Petaling': 'SGR02',
  'Klang': 'SGR02',
  'Shah Alam': 'SGR02',
  'Kuala Langat': 'SGR02',
  'Subang': 'SGR02',
  'Puchong': 'SGR02',
  'Damansara': 'SGR02',
  'Batu Caves': 'SGR01',
};

/**
 * Reverse geocode coordinates using Nominatim (OpenStreetMap).
 * Returns { displayName, zone, zoneName } or null on failure.
 */
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'ms,en', 'User-Agent': 'MySurauApp/1.0' },
    });

    if (!res.ok) throw new Error('Nominatim error');

    const data = await res.json();
    const addr = data.address || {};

    // Build display name
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.neighbourhood ||
      '';
    const state =
      addr.state ||
      addr.county ||
      '';

    const displayName = city && state ? `${city}, ${state}` : state || city || 'Malaysia';

    // Determine JAKIM zone
    const zoneInfo = resolveZone(state, city, addr);
    return { displayName, ...zoneInfo };
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
    return { displayName: 'Malaysia', zone: 'WLY01', zoneName: 'Kuala Lumpur' };
  }
}

function resolveZone(state, city, addr) {
  // Check if it's a Federal Territory by city name first
  if (city === 'Putrajaya' || addr.city === 'Putrajaya') {
    return { zone: 'WLY02', zoneName: 'Putrajaya' };
  }
  if (city === 'Labuan' || state === 'Labuan') {
    return { zone: 'WLY03', zoneName: 'Labuan' };
  }
  if (
    city === 'Kuala Lumpur' ||
    state === 'Federal Territory of Kuala Lumpur' ||
    state === 'Wilayah Persekutuan Kuala Lumpur'
  ) {
    return { zone: 'WLY01', zoneName: 'Kuala Lumpur' };
  }

  // Selangor district resolution
  if (state === 'Selangor' || state === 'Selangor Darul Ehsan') {
    const district =
      addr.county ||
      addr.suburb ||
      addr.city ||
      addr.town ||
      '';
    for (const [key, zone] of Object.entries(SELANGOR_DISTRICTS)) {
      if (district.includes(key) || city.includes(key)) {
        return { zone, zoneName: `Selangor (${district || city})` };
      }
    }
    return { zone: 'SGR01', zoneName: 'Selangor' };
  }

  // Lookup by state
  for (const [key, info] of Object.entries(ZONE_MAP)) {
    if (state && (state === key || state.includes(key) || key.includes(state))) {
      return info;
    }
    if (city && (city === key || city.includes(key))) {
      return info;
    }
  }

  return { zone: 'WLY01', zoneName: 'Kuala Lumpur' };
}

/**
 * Full list of JAKIM zones for the zone selector dropdown.
 */
export const ALL_ZONES = [
  { code: 'WLY01', name: 'Kuala Lumpur / Putrajaya' },
  { code: 'WLY02', name: 'Putrajaya' },
  { code: 'WLY03', name: 'Labuan' },
  { code: 'PLS01', name: 'Perlis' },
  { code: 'KDH01', name: 'Kedah – Kota Setar, Kubang Pasu' },
  { code: 'KDH02', name: 'Kedah – Kuala Muda, Yan, Pendang' },
  { code: 'KDH03', name: 'Kedah – Padang Terap, Sik' },
  { code: 'KDH04', name: 'Kedah – Baling' },
  { code: 'KDH05', name: 'Kedah – Bandar Baharu, Kulim' },
  { code: 'KDH06', name: 'Kedah – Langkawi' },
  { code: 'KDH07', name: 'Kedah – Puncak Janing' },
  { code: 'PNG01', name: 'Pulau Pinang – Timur Laut, Barat Daya' },
  { code: 'PNG02', name: 'Pulau Pinang – S.P Tengah, S.P Selatan, S.P Utara' },
  { code: 'PRK01', name: 'Perak – Manjung, Kinta, Larut' },
  { code: 'PRK02', name: 'Perak – Kerian, Seri Iskandar' },
  { code: 'PRK03', name: 'Perak – Lenggong' },
  { code: 'PRK04', name: 'Perak – Hulu Perak' },
  { code: 'PRK05', name: 'Perak – Grik' },
  { code: 'PRK06', name: 'Perak – Temengor, Belum' },
  { code: 'PRK07', name: 'Perak – Batang Padang' },
  { code: 'PRK08', name: 'Perak – Hilir Perak' },
  { code: 'SGR01', name: 'Selangor – Gombak, Hulu Langat, Sepang' },
  { code: 'SGR02', name: 'Selangor – Petaling, Klang, Shah Alam' },
  { code: 'NGS01', name: 'Negeri Sembilan – Jelebu, Kuala Pilah, Rembau, S.Ujong' },
  { code: 'NGS02', name: 'Negeri Sembilan – Jempol, Tampin' },
  { code: 'NGS03', name: 'Negeri Sembilan – Port Dickson' },
  { code: 'MLK01', name: 'Melaka' },
  { code: 'JHR01', name: 'Johor – Pulau Aur, Pulau Pemanggil' },
  { code: 'JHR02', name: 'Johor – Kota Tinggi, Mersing, Kluang' },
  { code: 'JHR03', name: 'Johor – Johor Bahru, Pontian, Kulai' },
  { code: 'JHR04', name: 'Johor – Batu Pahat, Muar, Segamat' },
  { code: 'PHG01', name: 'Pahang – Pulau Tioman' },
  { code: 'PHG02', name: 'Pahang – Kuantan, Pekan, Rompin' },
  { code: 'PHG03', name: 'Pahang – Maran, Chenor, Temerloh' },
  { code: 'PHG04', name: 'Pahang – Raub, Bentong, Cameron, Lipis' },
  { code: 'PHG05', name: 'Pahang – Genting, Janda Baik' },
  { code: 'PHG06', name: 'Pahang – Bera, Jerantut, Tembeling' },
  { code: 'TRG01', name: 'Terengganu – Kuala Terengganu, Marang, Hulu Terengganu' },
  { code: 'TRG02', name: 'Terengganu – Besut, Setiu' },
  { code: 'TRG03', name: 'Terengganu – Kemaman' },
  { code: 'TRG04', name: 'Terengganu – Dungun' },
  { code: 'KTN01', name: 'Kelantan – Kota Bharu, Bachok, Tumpat' },
  { code: 'KTN02', name: 'Kelantan – Kuala Krai, Machang, Pasir Mas' },
  { code: 'SBH01', name: 'Sabah – Kota Kinabalu, Ranau, Kota Belud' },
  { code: 'SBH02', name: 'Sabah – Sandakan, Kinabatangan' },
  { code: 'SBH03', name: 'Sabah – Lahad Datu, Semporna' },
  { code: 'SBH04', name: 'Sabah – Tawau, Kunak' },
  { code: 'SBH05', name: 'Sabah – Papar, Penampang' },
  { code: 'SBH06', name: 'Sabah – Tuaran, Kota Marudu, Pitas' },
  { code: 'SBH07', name: 'Sabah – Keningau, Tambunan, Nabawan' },
  { code: 'SWK01', name: 'Sarawak – Kuching, Bau, Lundu, Samarahan, Simunjan, Serian, Tebedu' },
  { code: 'SWK02', name: 'Sarawak – Sri Aman, Lubok Antu, Betong, Saratok' },
  { code: 'SWK03', name: 'Sarawak – Sibu, Dalat, Mukah, Selangau' },
  { code: 'SWK04', name: 'Sarawak – Sarikei, Julau, Meradong, Daro' },
  { code: 'SWK05', name: 'Sarawak – Kapit, Song, Belaga' },
  { code: 'SWK06', name: 'Sarawak – Miri, Niah, Subis, Bekenu, Marudi, Baram' },
  { code: 'SWK07', name: 'Sarawak – Limbang, Lawas, Sundar, Temburong' },
  { code: 'SWK08', name: 'Sarawak – Bintulu, Sebauh, Tatau' },
  { code: 'SWK09', name: 'Sarawak – Spaoh, Pusa, Kabong, Lingga, Engkelili, Maludam' },
];
