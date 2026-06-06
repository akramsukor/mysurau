import { useMemo } from 'react';
import { formatDistance } from '../utils/overpassApi';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function categoryLabel(category) {
  if (!category) return 'Surau';
  const c = category.toLowerCase();
  if (c.includes('masjid') || c.includes('mosque')) return 'Mosque';
  if (c.includes('musolla') || c.includes('musalla')) return 'Musolla';
  if (c.includes('prayer room') || c.includes('bilik solat')) return 'Prayer room';
  return 'Surau';
}

function SkeletonCard() {
  return (
    <div className="sc-card sc-card--skeleton">
      <div className="sc-sk sc-sk--title shimmer-gray" />
      <div className="sc-sk sc-sk--dist shimmer-gray" />
      <div className="sc-sk sc-sk--row shimmer-gray" />
    </div>
  );
}

export default function SurauCards({ suraus, userLocation, searchQuery, onSelectSurau, loading }) {
  const listed = useMemo(() => {
    let list = suraus;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s => s.name?.toLowerCase().includes(q));
    }

    if (userLocation) {
      list = [...list].sort((a, b) => {
        const da = haversine(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const db = haversine(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return da - db;
      });
    }

    return list.slice(0, 30);
  }, [suraus, userLocation, searchQuery]);

  if (loading && suraus.length === 0) {
    return (
      <div className="sc-scroll">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  if (!loading && listed.length === 0) {
    return (
      <div className="sc-scroll">
        <div className="sc-card sc-card--empty">
          <p className="sc-empty-text">No surau found</p>
          <p className="sc-empty-hint">Try a different search</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-scroll">
      {listed.map(s => {
        const dist = userLocation
          ? formatDistance(haversine(userLocation.lat, userLocation.lng, s.lat, s.lng))
          : null;
        return (
          <button key={s.id} className="sc-card" onClick={() => onSelectSurau(s)}>
            <p className="sc-name">{s.name}</p>
            {dist && <p className="sc-dist">{dist}</p>}
            <div className="sc-bottom">
              <span className="sc-badge">{categoryLabel(s.category)}</span>
              <span className="sc-view">View →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
