import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { getCategoryColor } from '../utils/surauApi';

/* ────────────────────────── Custom div icons ────────────────────────── */
const MOSQUE_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:60%;height:60%;display:block;margin:auto">
  <path d="M12 9.92397C16.9705 9.92397 21 12.8117 21 16.374C21 17.1937 20.7865 17.9776 20.3973 18.699H3.60261C3.2135 17.9776 2.99998 17.1937 2.99998 16.374C2.99998 12.8117 7.02941 9.92397 12 9.92397Z" fill="white"/>
  <path d="M2.09998 20.499C2.09998 20.1676 2.3686 19.899 2.69998 19.899H21.225C21.5563 19.899 21.825 20.1676 21.825 20.499V21.399C21.825 21.7303 21.5563 21.999 21.225 21.999H2.69998C2.36861 21.999 2.09998 21.7303 2.09998 21.399V20.499Z" fill="white"/>
  <path d="M17.5933 11.349H17.55V15.624H6.37498V11.349H6.33169L11.9625 7.97397L17.5933 11.349Z" fill="white"/>
  <path d="M11.0316 0.449951C10.8346 0.888778 10.725 1.37536 10.725 1.88755C10.725 3.82805 12.2981 5.40118 14.2386 5.4012C14.8889 5.4012 15.4979 5.22422 16.0204 4.91619C15.471 6.13988 14.2418 6.99216 12.8135 6.99216C10.8731 6.99215 9.29998 5.41909 9.29998 3.47859C9.29998 2.18851 9.99536 1.06098 11.0316 0.449951Z" fill="white"/>
  <path d="M11.7 5.72397H12.3V9.17397H11.7V5.72397Z" fill="white"/>
</svg>`;

const MARKER_SIZE = 38;

const createSurauIcon = (category, isSelected = false, status = null, fridayPrayer = false) => {
  const bg = getCategoryColor(category);
  const border = isSelected ? '#FFD600' : fridayPrayer ? '#22c55e' : 'rgba(255,255,255,0.8)';
  const opacity = status === 'temporarily_closed' ? '0.48' : '1';

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;
        background:${bg};
        border:3px solid ${border};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        cursor:pointer;
        overflow:hidden;
        opacity:${opacity};
      ">${MOSQUE_SVG}</div>`,
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
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
function Recenter({ lat, lon, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom, { animate: true });
  }, [lat, lon, zoom, map]);
  return null;
}

/* ────────────────────────── Min-zoom enforcer ──────────────────────── */
function MinZoomController() {
  const map = useMap();

  const compute = useCallback(() => {
    const container = map.getContainer();
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (!w || !h) return;
    const cosLat = Math.abs(Math.cos((map.getCenter().lat * Math.PI) / 180));
    // smallest z where (minDim/2) * metersPerPixel <= 1000 m
    const minZ = Math.ceil(Math.log2((Math.min(w, h) / 2) * 156543.034 * cosLat / 1000));
    map.setMinZoom(Math.max(minZ, 10));
  }, [map]);

  useEffect(() => {
    compute();
    map.on('moveend', compute);
    window.addEventListener('resize', compute);
    return () => {
      map.off('moveend', compute);
      window.removeEventListener('resize', compute);
    };
  }, [map, compute]);

  return null;
}

/* ────────────────────────── Bounds tracker ────────────────────────── */
function BoundsTracker({ onBoundsChange }) {
  const map = useMap();

  const update = useCallback(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  useMapEvents({ moveend: update, zoomend: update });

  useEffect(() => {
    try { update(); } catch (_) { /* map not ready yet */ }
  }, [update]);

  return null;
}

/* ────────────────────────── Main component ────────────────────────── */
export default function MapView({
  center,
  userLocation,
  surauList,
  selectedSurau,
  onSurauSelect,
  onLocateMe,
}) {
  const mapRef = useRef(null);
  const [bounds, setBounds] = useState(null);

  // No flyTo on pin click — keep current zoom level

  // Filter to visible viewport + 20% buffer
  const visibleSurau = useMemo(() => {
    if (!bounds) return surauList;
    const padded = bounds.pad(0.2);
    return surauList.filter(s => padded.contains([s.lat, s.lon]));
  }, [surauList, bounds]);

  const markers = useMemo(
    () =>
      visibleSurau.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lon]}
          icon={createSurauIcon(s.category, selectedSurau?.id === s.id, s.status, s.friday_prayer)}
          eventHandlers={{ click: () => onSurauSelect(s) }}
          zIndexOffset={selectedSurau?.id === s.id ? 1000 : 0}
        >
          <Tooltip permanent direction="bottom" offset={[0, 19.5]} className="surau-label">
            {s.name}
          </Tooltip>
        </Marker>
      )),
    [visibleSurau, selectedSurau, onSurauSelect]
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
          attribution='&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />

        <Recenter lat={center.lat} lon={center.lon} zoom={14} />
        <MinZoomController />
        <BoundsTracker onBoundsChange={setBounds} />

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
              pathOptions={{
                color: '#1976D2',
                fillColor: '#1976D2',
                fillOpacity: 0.07,
                weight: 1,
              }}
            />
          </>
        )}

        {markers}
      </MapContainer>

      {/* Floating action buttons */}
      <div className="map-fabs">
        <button className="map-fab" onClick={onLocateMe} title="Lokasi Saya">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      {/* Zoom controls */}
      <div className="map-zoom">
        <button className="map-zoom-btn" onClick={() => mapRef.current?.zoomIn()} title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button className="map-zoom-btn" onClick={() => mapRef.current?.zoomOut()} title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
