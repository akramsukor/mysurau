import { useState } from 'react';
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

export default function SearchPanel({
  surauList,
  userLocation,
  searchQuery,
  onSearchChange,
  filterType,
  onFilterChange,
  selectedSurau,
  onSurauSelect,
  loading,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const filtered = surauList.filter((s) => {
    const matchSearch =
      !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterType === 'all' || s.category === filterType;
    return matchSearch && matchFilter;
  });


  return (
    <div className={`search-panel ${isExpanded ? 'search-panel--expanded' : ''}`}>
      {/* Drag handle */}
      <div
        className="search-panel__handle"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="search-panel__handle-bar" />
      </div>

      {/* Search input */}
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

      {/* Filter tabs */}
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

      {/* Results list */}
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
}
