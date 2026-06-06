import { useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

// ── Icons ────────────────────────────────────────────────────────────────────

// Teal circle with a white mosque silhouette (dome + two minarets)
const MOSQUE_PATH =
  'M10,1.5C8.8,1.5,7.8,2.4,7.2,3.4C6.8,4.1,7,5,7,5H6V6' +
  'H5.5C5,6,4.5,6.5,4.5,7V8H3.5V9H16.5V8H15.5V7C15.5,6.5,15,6,14.5,6H14V5' +
  'H13C13,5,13.2,4.1,12.8,3.4C12.2,2.4,11.2,1.5,10,1.5Z' +
  'M3.5,10V17H7V13.5C7,12.7,8.3,12,10,12C11.7,12,13,12.7,13,13.5V17H16.5V10H3.5Z' +
  'M5,11H7V13H5V11Z M13,11H15V13H13V11Z';

const surauIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;
    background:#008CB3;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,0.32);
  "><svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path fill="white" d="${MOSQUE_PATH}"/>
  </svg></div>`,
  iconSize:    [36, 36],
  iconAnchor:  [18, 18],
  popupAnchor: [0, -22],
});

const userDotIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;
    background:#008CB3;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 0 0 3px rgba(0,140,179,0.25);
  "></div>`,
  iconSize:   [16, 16],
  iconAnchor: [8, 8],
});

// ── Internal helpers ─────────────────────────────────────────────────────────

function Recenter({ center }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!center) return;
    const lat = center.lat;
    const lng = center.lng ?? center.lon;
    if (!prev.current || prev.current.lat !== lat || prev.current.lng !== lng) {
      prev.current = { lat, lng };
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

function LongPressEvents({ onLongPress }) {
  const map = useMap();
  useEffect(() => {
    let timer = null;
    let moved  = false;

    const start = (e) => {
      moved = false;
      timer = setTimeout(() => {
        if (!moved) onLongPress(e.latlng);
        timer = null;
      }, 600);
    };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const onMove = () => { moved = true; cancel(); };
    const onCtx  = (e) => {
      L.DomEvent.preventDefault(e.originalEvent);
      cancel();
      onLongPress(e.latlng);
    };

    map.on('mousedown',   start);
    map.on('touchstart',  start);
    map.on('mousemove',   onMove);
    map.on('touchmove',   onMove);
    map.on('mouseup',     cancel);
    map.on('touchend',    cancel);
    map.on('contextmenu', onCtx);

    return () => {
      map.off('mousedown',   start);
      map.off('touchstart',  start);
      map.off('mousemove',   onMove);
      map.off('touchmove',   onMove);
      map.off('mouseup',     cancel);
      map.off('touchend',    cancel);
      map.off('contextmenu', onCtx);
      if (timer) clearTimeout(timer);
    };
  }, [map, onLongPress]);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MapView({
  center,
  userLocation,
  suraus = [],
  onSelectSurau,
  onLongPressMap,
  onLocateMe,
}) {
  const mapRef = useRef(null);

  const centerLat = center?.lat ?? 3.139;
  const centerLng = center?.lng ?? center?.lon ?? 101.6869;

  const handleLongPress = useCallback((latlng) => {
    console.warn('[MapView] long-press → Add surau here (Slice 8)', latlng);
    onLongPressMap?.(latlng);
  }, [onLongPressMap]);

  const handleRecenter = useCallback(() => {
    onLocateMe?.();
    if (mapRef.current) {
      mapRef.current.flyTo([centerLat, centerLng], 15, { duration: 0.8 });
    }
  }, [onLocateMe, centerLat, centerLng]);

  const pins = useMemo(() =>
    suraus.map(s => (
      <Marker
        key={s.id}
        position={[s.lat, s.lng]}
        icon={surauIcon}
        eventHandlers={{
          click: () => {
            console.warn('[MapView] pin tap → SurauDetailSheet (Slice 7)', s.name);
            onSelectSurau?.(s);
          },
        }}
      />
    )),
  [suraus, onSelectSurau]);

  return (
    <div className="map-wrapper">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={15}
        scrollWheelZoom
        zoomControl={false}
        className="leaflet-map"
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution=""
        />

        <Recenter center={center} />
        <LongPressEvents onLongPress={handleLongPress} />

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lon ?? userLocation.lng]}
            icon={userDotIcon}
          />
        )}

        {pins}
      </MapContainer>

      {/* ── Controls — bottom-right stack ── */}
      <div className="map-controls">
        {/* Recenter */}
        <button
          className="map-ctrl-btn"
          onClick={handleRecenter}
          aria-label="Re-centre map"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9"/>
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
            <line x1="12" y1="2"  x2="12" y2="5"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="2"  y1="12" x2="5"  y2="12"/>
            <line x1="19" y1="12" x2="22" y2="12"/>
          </svg>
        </button>

        {/* Zoom card */}
        <div className="map-ctrl-zoom">
          <button
            className="map-ctrl-btn map-ctrl-btn--zoom"
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="Zoom in"
          >+</button>
          <div className="map-ctrl-zoom-divider" />
          <button
            className="map-ctrl-btn map-ctrl-btn--zoom"
            onClick={() => mapRef.current?.zoomOut()}
            aria-label="Zoom out"
          >−</button>
        </div>
      </div>

      {/* ── OSM attribution — bottom-left ── */}
      <div className="map-osm-attr">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a> contributors
      </div>
    </div>
  );
}
