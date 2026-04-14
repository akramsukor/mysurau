import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatDistance } from '../utils/overpassApi';

/* ────────────────────────── Custom div icons ────────────────────────── */
const createSurauIcon = (category, isSelected = false) => {
  const isMasjid = category === 'masjid';
  const isPetrol = category === 'petrol';
  const bg = isMasjid ? '#1565C0' : isPetrol ? '#E65100' : '#2E7D52';
  const border = isSelected ? '#FFD600' : 'rgba(255,255,255,0.8)';
  const size = isSelected ? 46 : isMasjid ? 40 : 34;
  const emoji = isMasjid ? '🕌' : isPetrol ? '⛽' : '🕍';
  const fontSize = isSelected ? 22 : isMasjid ? 20 : 16;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${bg};
        border:3px solid ${border};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:${fontSize}px;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        cursor:pointer;
        transition:transform 0.15s ease;
      ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
};

const userIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width:18px;height:18px;
      background:#1976D2;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 0 0 4px rgba(25,118,210,0.35);
    "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/* ────────────────────────── Map recenter helper ────────────────────── */
function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

/* ────────────────────────── Google Maps URL ───────────────────────── */
function googleMapsUrl(lat, lon, name) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${encodeURIComponent(name)}`;
}

/* ────────────────────────── Main component ────────────────────────── */
export default function MapView({
  center,
  userLocation,
  surauList,
  selectedSurau,
  onSurauSelect,
  onRefresh,
  onLocateMe,
}) {
  const mapRef = useRef(null);

  // Fly to selected surau
  useEffect(() => {
    if (selectedSurau && mapRef.current) {
      mapRef.current.flyTo([selectedSurau.lat, selectedSurau.lon], 17, { duration: 0.8 });
    }
  }, [selectedSurau]);

  const markers = useMemo(
    () =>
      surauList.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lon]}
          icon={createSurauIcon(s.category, selectedSurau?.id === s.id)}
          eventHandlers={{ click: () => onSurauSelect(s) }}
          zIndexOffset={selectedSurau?.id === s.id ? 1000 : 0}
        >
          <Popup maxWidth={240} className="surau-popup">
            <div className="popup-content">
              <div className="popup-icon">
                {s.category === 'masjid' ? '🕌' : s.category === 'petrol' ? '⛽' : '🕍'}
              </div>
              <div className="popup-body">
                <div className="popup-name">{s.name}</div>
                <div className="popup-type">
                  {s.category === 'masjid' ? 'Masjid' : s.category === 'petrol' ? 'Stesen Minyak (Ada Surau)' : 'Surau / Musolla'}
                  {s.level && ` · Aras ${s.level}`}
                </div>
                {s.address && <div className="popup-address">{s.address}</div>}
                {s.distance != null && (
                  <div className="popup-distance">📍 {formatDistance(s.distance)}</div>
                )}
                <a
                  href={googleMapsUrl(s.lat, s.lon, s.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="popup-nav-btn"
                >
                  🗺 Dapatkan Arah
                </a>
              </div>
            </div>
          </Popup>
        </Marker>
      )),
    [surauList, selectedSurau, onSurauSelect]
  );

  return (
    <div className="map-wrapper">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={14}
        className="leaflet-map"
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <Recenter center={[center.lat, center.lon]} zoom={14} />

        {/* User location */}
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon}>
              <Popup>
                <div className="popup-content">
                  <div className="popup-icon">📍</div>
                  <div className="popup-body">
                    <div className="popup-name">Lokasi Anda</div>
                  </div>
                </div>
              </Popup>
            </Marker>
            <CircleMarker
              center={[userLocation.lat, userLocation.lon]}
              radius={60}
              pathOptions={{ color: '#1976D2', fillColor: '#1976D2', fillOpacity: 0.07, weight: 1 }}
            />
          </>
        )}

        {/* Surau markers */}
        {markers}
      </MapContainer>

      {/* Floating action buttons */}
      <div className="map-fabs">
        <button className="map-fab" onClick={onLocateMe} title="Lokasi Saya">
          <span>📍</span>
        </button>
        <button className="map-fab" onClick={onRefresh} title="Muat Semula">
          <span>🔄</span>
        </button>
      </div>

      {/* Zoom controls */}
      <div className="map-zoom">
        <button
          className="map-zoom-btn"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          className="map-zoom-btn"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
      </div>
    </div>
  );
}
