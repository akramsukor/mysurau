import { DISTRICT_ZONE_MAP, STATE_DEFAULT_ZONE } from './jakimZones.js';

const COUNCIL_PREFIXES = [
  'majlis bandaraya ',
  'majlis perbandaran ',
  'majlis daerah ',
  'dewan bandaraya ',
  'perbadanan ',
  'daerah ',
  'w.p. ',
  'wilayah persekutuan ',
];

// Strip council/authority prefixes and reject pure acronyms (e.g. MBSJ, MPKj).
export function cleanPlaceName(raw) {
  if (!raw) return '';
  let s = raw;
  for (const prefix of COUNCIL_PREFIXES) {
    if (s.toLowerCase().startsWith(prefix)) {
      s = s.slice(prefix.length).trim();
      break;
    }
  }
  // Reject acronyms: starts with 2+ consecutive uppercase letters
  if (/^[A-Z]{2,}/.test(s) && s.length <= 6) return '';
  return s;
}

// Normalise for DISTRICT_ZONE_MAP key lookup.
function normalize(s) {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')     // strip diacritics
    .toLowerCase()
    .replace(/^(daerah |w\.p\. |wp |wilayah persekutuan )/, '')
    .replace(/ district$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupDistrict(raw) {
  if (!raw) return null;
  // Try cleanPlaceName first (strips "Majlis Perbandaran Muar" → "Muar")
  const cleaned = cleanPlaceName(raw);
  if (cleaned) {
    const zone = DISTRICT_ZONE_MAP[normalize(cleaned)];
    if (zone) return zone;
  }
  // Also try the raw value directly
  const zone = DISTRICT_ZONE_MAP[normalize(raw)];
  return zone || null;
}

function resolveZone(addr, label) {
  // Candidate order per spec: county → state_district → city → municipality → town → label
  const candidates = [
    addr.county,
    addr.state_district,
    addr.city,
    addr.municipality,
    addr.town,
    label,
  ];

  for (const raw of candidates) {
    const zone = lookupDistrict(raw);
    if (zone) {
      const display = cleanPlaceName(raw) || raw;
      return { zone, zoneName: display };
    }
  }

  // State-level fallback
  const stateNorm = normalize(addr.state || '');
  if (stateNorm) {
    for (const [key, zone] of STATE_DEFAULT_ZONE) {
      if (stateNorm.includes(key)) {
        return { zone, zoneName: addr.state || '' };
      }
    }
  }

  return { zone: 'WLY01', zoneName: 'Kuala Lumpur' };
}

const sessionKey = (lat, lon) =>
  `ms_geo_${lat.toFixed(3)}_${lon.toFixed(3)}`;

export async function reverseGeocode(lat, lon) {
  const key = sessionKey(lat, lon);
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch {}

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1&accept-language=ms,en`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MySurau/1.0 (mysurau.com; contact@mysurau.com)',
        'Referer': 'https://mysurau.com',
      },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const data = await res.json();
    const addr = data.address || {};

    // Pick display label: prefer smaller/more specific place names
    const candidates = [
      addr.town,
      addr.village,
      addr.suburb,
      addr.city_district,
      addr.city,
      addr.municipality,
      addr.county,
    ];

    let displayName = '';
    for (const c of candidates) {
      const cleaned = cleanPlaceName(c);
      if (cleaned) { displayName = cleaned; break; }
    }
    if (!displayName) displayName = addr.state || 'Malaysia';

    const { zone, zoneName } = resolveZone(addr, displayName);
    const result = { displayName, zone, zoneName };

    try { sessionStorage.setItem(key, JSON.stringify(result)); } catch {}
    return result;
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
    return { displayName: 'Kuala Lumpur', zone: 'WLY01', zoneName: 'Kuala Lumpur' };
  }
}

// Full zone list for the ZoneSelector dropdown.
// Descriptions aligned with DISTRICT_ZONE_MAP.
export const ALL_ZONES = [
  { code: 'WLY01', name: 'Kuala Lumpur & Putrajaya' },
  { code: 'WLY02', name: 'Wilayah Persekutuan Labuan' },
  { code: 'PLS01', name: 'Perlis' },
  { code: 'KDH01', name: 'Kedah – Kota Setar, Kubang Pasu, Pokok Sena' },
  { code: 'KDH02', name: 'Kedah – Kuala Muda, Yan, Pendang' },
  { code: 'KDH03', name: 'Kedah – Padang Terap, Sik' },
  { code: 'KDH04', name: 'Kedah – Baling' },
  { code: 'KDH05', name: 'Kedah – Bandar Baharu, Kulim' },
  { code: 'KDH06', name: 'Kedah – Langkawi' },
  { code: 'KDH07', name: 'Kedah – Puncak Janing' },
  { code: 'PNG01', name: 'Pulau Pinang' },
  { code: 'PRK01', name: 'Perak – Muallim, Batang Padang' },
  { code: 'PRK02', name: 'Perak – Kinta, Ipoh, Kuala Kangsar, Kampar' },
  { code: 'PRK03', name: 'Perak – Hulu Perak, Gerik, Lenggong' },
  { code: 'PRK05', name: 'Perak – Hilir Perak, Manjung, Teluk Intan' },
  { code: 'PRK06', name: 'Perak – Larut Matang, Taiping, Kerian' },
  { code: 'SGR01', name: 'Selangor – Gombak, Petaling, Hulu Langat, Sepang, Shah Alam' },
  { code: 'SGR02', name: 'Selangor – Kuala Selangor, Sabak Bernam' },
  { code: 'SGR03', name: 'Selangor – Klang, Kuala Langat' },
  { code: 'NGS01', name: 'Negeri Sembilan – Tampin, Jempol' },
  { code: 'NGS02', name: 'Negeri Sembilan – Jelebu, Kuala Pilah, Rembau' },
  { code: 'NGS03', name: 'Negeri Sembilan – Port Dickson, Seremban' },
  { code: 'MLK01', name: 'Melaka' },
  { code: 'JHR01', name: 'Johor – Pulau Aur, Pulau Pemanggil' },
  { code: 'JHR02', name: 'Johor – Johor Bahru, Kota Tinggi, Mersing, Kulai' },
  { code: 'JHR03', name: 'Johor – Kluang, Pontian' },
  { code: 'JHR04', name: 'Johor – Batu Pahat, Muar, Segamat, Tangkak' },
  { code: 'PHG01', name: 'Pahang – Pulau Tioman' },
  { code: 'PHG02', name: 'Pahang – Kuantan, Pekan, Rompin' },
  { code: 'PHG03', name: 'Pahang – Temerloh, Maran, Bera, Jerantut' },
  { code: 'PHG04', name: 'Pahang – Raub, Bentong, Lipis' },
  { code: 'PHG05', name: 'Pahang – Genting, Janda Baik' },
  { code: 'PHG06', name: 'Pahang – Cameron Highlands' },
  { code: 'TRG01', name: 'Terengganu – Kuala Terengganu, Marang, Kuala Nerus' },
  { code: 'TRG02', name: 'Terengganu – Besut, Setiu' },
  { code: 'TRG03', name: 'Terengganu – Hulu Terengganu' },
  { code: 'TRG04', name: 'Terengganu – Dungun, Kemaman' },
  { code: 'KTN01', name: 'Kelantan – Kota Bharu, Bachok, Tumpat, Pasir Mas' },
  { code: 'KTN02', name: 'Kelantan – Gua Musang, Jeli' },
  { code: 'SBH01', name: 'Sabah – Sandakan' },
  { code: 'SBH02', name: 'Sabah – Beluran' },
  { code: 'SBH03', name: 'Sabah – Lahad Datu, Semporna, Kunak' },
  { code: 'SBH04', name: 'Sabah – Tawau, Kalabakan' },
  { code: 'SBH05', name: 'Sabah – Kudat, Kota Marudu, Pitas' },
  { code: 'SBH06', name: 'Sabah – Ranau' },
  { code: 'SBH07', name: 'Sabah – Kota Kinabalu, Papar, Penampang, Tuaran' },
  { code: 'SBH08', name: 'Sabah – Keningau, Tambunan, Nabawan' },
  { code: 'SBH09', name: 'Sabah – Beaufort, Tenom, Sipitang' },
  { code: 'SWK01', name: 'Sarawak – Limbang, Lawas' },
  { code: 'SWK02', name: 'Sarawak – Miri, Marudi, Bekenu' },
  { code: 'SWK03', name: 'Sarawak – Bintulu, Tatau' },
  { code: 'SWK04', name: 'Sarawak – Sibu, Mukah, Kapit' },
  { code: 'SWK05', name: 'Sarawak – Sarikei' },
  { code: 'SWK06', name: 'Sarawak – Sri Aman, Betong' },
  { code: 'SWK07', name: 'Sarawak – Serian, Samarahan' },
  { code: 'SWK08', name: 'Sarawak – Kuching, Bau, Lundu' },
  { code: 'SWK09', name: 'Sarawak – Asajaya, Pusa, Kabong' },
];
