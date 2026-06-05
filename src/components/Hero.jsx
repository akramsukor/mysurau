import { useMemo } from 'react';

const KL_TZ = 'Asia/Kuala_Lumpur';

function todayGregorian() {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: KL_TZ,
  }).format(new Date()); // "6 Jun 2026"
}

export default function Hero({ locationName, hijriDate, onRefresh, onOpenMenu }) {
  const gregDate = useMemo(todayGregorian, []);
  const isLoading = !locationName;

  return (
    <div className="hero">
      <div className="hero__inner">
        {/* ── Left column: location + date ── */}
        <div className="hero__left">
          {isLoading ? (
            <>
              <div className="hero__skeleton hero__skeleton--name shimmer-light" />
              <div className="hero__skeleton hero__skeleton--date shimmer-light" />
            </>
          ) : (
            <>
              <div className="hero__location-row">
                <span className="hero__location-name">{locationName}</span>
                <button
                  className="hero__refresh-btn"
                  onClick={onRefresh}
                  aria-label="Muat semula lokasi"
                >
                  ↻
                </button>
              </div>
              <p className="hero__date">
                {gregDate}{hijriDate ? ` | ${hijriDate}` : ''}
              </p>
            </>
          )}
        </div>

        {/* ── Right: hamburger ── */}
        <button
          className="hero__menu-btn"
          onClick={onOpenMenu}
          aria-label="Buka menu"
        >
          ≡
        </button>
      </div>
    </div>
  );
}
