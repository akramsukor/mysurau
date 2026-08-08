export default function SearchBar({ value, onChange, onClear }) {
  return (
    <div className="sb-wrap">
      <span className="sb-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>
      <input
        className="sb-input"
        type="search"
        placeholder="Search a surau…"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Search surau"
      />
      {value && (
        <button className="sb-clear" onClick={onClear} aria-label="Clear search">
          ✕
        </button>
      )}
    </div>
  );
}
