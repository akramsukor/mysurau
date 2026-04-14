import { useState } from 'react';
import { ALL_ZONES } from '../utils/zoneDetection';

export default function ZoneSelector({ currentZone, onSelect, onClose }) {
  const [query, setQuery] = useState('');

  const filtered = ALL_ZONES.filter(
    (z) =>
      z.code.toLowerCase().includes(query.toLowerCase()) ||
      z.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="zone-overlay" onClick={onClose}>
      <div className="zone-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zone-modal__header">
          <h2 className="zone-modal__title">Pilih Zon JAKIM</h2>
          <button className="zone-modal__close" onClick={onClose}>✕</button>
        </div>

        <input
          className="zone-modal__search"
          type="search"
          placeholder="Cari zon (contoh: Selangor, WLY01...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className="zone-modal__list">
          {filtered.map((z) => (
            <button
              key={z.code}
              className={`zone-item ${z.code === currentZone ? 'zone-item--active' : ''}`}
              onClick={() => { onSelect(z.code, z.name); onClose(); }}
            >
              <span className="zone-item__code">{z.code}</span>
              <span className="zone-item__name">{z.name}</span>
              {z.code === currentZone && <span className="zone-item__check">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
