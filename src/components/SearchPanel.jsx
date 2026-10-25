import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { formatDistance } from '../utils/overpassApi';

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'masjid', label: '🕌 Masjid' },
  { key: 'surau', label: '🕍 Surau' },
  { key: 'petrol', label: '⛽ Stesen Minyak' },
];

function categoryMeta(category) {
  if (category === 'masjid') return { emoji: '🕌', label: 'Masjid', css: 'tag--masjid', iconCss: 'surau-card__icon--masjid' };
  if (category === 'petrol') return { emoji: '⛽', label: 'Stesen Minyak (Ada Surau)', css: 'tag--petrol', iconCss: 'surau-card__icon--petrol' };
  return { emoji: '🕍', label: 'Surau / Musolla', css: 'tag--surau', iconCss: 'surau-card__icon--surau' };
}

function SurauCard({ surau, isSelected, onClick }) {
  const meta = categoryMeta(surau.category);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${surau.lat},${surau.lon}`;
  const wazeUrl = `https://waze.com/ul?ll=${surau.lat},${surau.lon}&navigate=yes`;

  return (
    <div
      className={`surau-card ${isSelected ? 'surau-card--selected' : ''}`}
      onClick={onClick}
    >
      <div className={`surau-card__icon ${meta.iconCss}`}>
        {meta.emoji}
      </div>
      <div className="surau-card__body">
        <div className="surau-card__name">{surau.name}</div>
        <div className="surau-card__meta">
          <span className={`surau-card__type ${meta.css}`}>
            {meta.label}
          </span>
          {surau.level && (
            <span className="surau-card__level">Aras {surau.level}</span>
          )}
          {surau.distance != null && (
            <span className="surau-card__dist">📍 {formatDistance(surau.distance)}</span>
          )}
        </div>
        {surau.address && (
          <div className="surau-card__address">{surau.address}</div>
        )}
        <div className="surau-card__nav">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-btn nav-btn--gmaps"
            onClick={(e) => e.stopPropagation()}
          >
            🗺 Google Maps
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nav-btn nav-btn--waze"
            onClick={(e) => e.stopPropagation()}
          >
            🚗 Waze
          </a>
        </div>
      </div>
    </div>
  );
}

const PEEK_H = 136;
const EXPANDED_H = () => Math.round(window.innerHeight * 0.72);

const SearchPanel = forwardRef(function SearchPanel({
  surauList,
  userLocation,
  searchQuery,
  onSearchChange,
  filterType,
  onFilterChange,
  selectedSurau,
  onSurauSelect,
  loading,
}, ref) {
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef(null);
  const dragState = useRef(null);

  useImperativeHandle(ref, () => ({
    expand: () => setIsExpanded(true),
  }));

  const handlePointerDown = useCallback((e) => {
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();

    const startY = e.clientY;
    dragState.current = {
      startY,
      startH: panel.offsetHeight,
      lastY: startY,
      lastTime: Date.now(),
      velocity: 0,
    };
    panel.style.transition = 'none';

    const onMove = (ev) => {
      const d = dragState.current;
      const dy = ev.clientY - d.startY;
      const newH = Math.max(60, Math.min(window.innerHeight * 0.94, d.startH - dy));

      const now = Date.now();
      const dt = now - d.lastTime || 1;
      d.velocity = (ev.clientY - d.lastY) / dt;
      d.lastY = ev.clientY;
      d.lastTime = now;

      panel.style.height = `${newH}px`;
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      const d = dragState.current;
      const currentH = panel.offsetHeight;
      const expandedH = EXPANDED_H();
      const midpoint = (PEEK_H + expandedH) / 2;

      let expand;
      if (d.velocity < -0.4) expand = true;
      else if (d.velocity > 0.4) expand = false;
      else expand = currentH > midpoint;

      panel.style.transition = '';
      panel.style.height = '';
      setIsExpanded(expand);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const filtered = surauList.filter((s) => {
    const matchSearch =
      !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterType === 'all' || s.category === filterType;
    return matchSearch && matchFilter;
  });

  return (
    <div
      ref={panelRef}
      className={`search-panel ${isExpanded ? 'search-panel--expanded' : ''}`}
    >
      <div
        className="search-panel__handle"
        onPointerDown={handlePointerDown}
        onClick={() => setIsExpanded((v) => !v)}
        style={{ touchAction: 'none', cursor: 'grab' }}
      >
        <div className="search-panel__handle-bar" />
      </div>

      <div className="search-panel__input-row">
        <div className="search-input-wrap">
          <span className="search-input-icon">🔍</span>
          <input
            className="search-input"
            type="search"
            placeholder="Cari surau, masjid..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsExpanded(true)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => onSearchChange('')}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-tab ${filterType === f.key ? 'filter-tab--active' : ''}`}
            onClick={() => onFilterChange(f.key)}
          >
            {f.label}
          </button>
        ))}
        <div className="filter-tab-count">{filtered.length} tempat</div>
      </div>

      <div className="surau-list">
        {loading && (
          <div className="surau-list__loading">
            <div className="spinner" />
            <span>Mencari surau berdekatan…</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="surau-list__empty">
            <div className="surau-list__empty-icon">🕌</div>
            <div>Tiada surau dijumpai dalam kawasan ini.</div>
            {searchQuery && (
              <button className="btn-link" onClick={() => onSearchChange('')}>
                Padam carian
              </button>
            )}
          </div>
        )}

        {filtered.map((s) => (
          <SurauCard
            key={s.id}
            surau={s}
            isSelected={selectedSurau?.id === s.id}
            onClick={() => {
              onSurauSelect(s);
              setIsExpanded(false);
            }}
          />
        ))}
      </div>
    </div>
  );
});

export default SearchPanel;
