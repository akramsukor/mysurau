import SearchBar from './SearchBar';
import SurauCards from './SurauCards';

export default function BottomPanel({
  suraus,
  userLocation,
  searchQuery,
  onSearchChange,
  onSelectSurau,
  loading,
}) {
  return (
    <div className="bp-panel">
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        onClear={() => onSearchChange('')}
      />
      <SurauCards
        suraus={suraus}
        userLocation={userLocation}
        searchQuery={searchQuery}
        onSelectSurau={onSelectSurau}
        loading={loading}
      />
    </div>
  );
}
