import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

/* ─── Action metadata ─── */
const ACTION_META = {
  request_add:    { label: 'Add',         cls: 'dash-chip--blue'  },
  request_change: { label: 'Change',      cls: 'dash-chip--amber' },
  request_delete: { label: 'Delete',      cls: 'dash-chip--red'   },
  user_change:    { label: 'User change', cls: 'dash-chip--grey'  },
  user_delete:    { label: 'User delete', cls: 'dash-chip--grey'  },
};

const FILTER_OPTIONS = [
  { value: '',               label: 'All actions'  },
  { value: 'request_add',    label: 'Add'          },
  { value: 'request_change', label: 'Change'       },
  { value: 'request_delete', label: 'Delete'       },
  { value: 'user_change',    label: 'User change'  },
  { value: 'user_delete',    label: 'User delete'  },
];

/* ─── Helpers ─── */

// surau_name for request_change can be a diff string ("Old -> New").
// Prefer the live surau.name embed; fall back to the left side of the diff.
function getSurauName(row) {
  if (row.surau?.name) return row.surau.name;
  if (!row.surau_name)  return '—';
  const arrow = row.surau_name.indexOf(' -> ');
  return arrow !== -1 ? row.surau_name.slice(0, arrow).trim() : row.surau_name;
}

function relativeTime(iso) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = new Date(iso).getTime() - Date.now(); // negative = past
  const abs  = Math.abs(diff);
  if (abs < 60_000)          return rtf.format(Math.round(diff / 1_000),          'second');
  if (abs < 3_600_000)       return rtf.format(Math.round(diff / 60_000),         'minute');
  if (abs < 86_400_000)      return rtf.format(Math.round(diff / 3_600_000),      'hour');
  if (abs < 604_800_000)     return rtf.format(Math.round(diff / 86_400_000),     'day');
  if (abs < 2_592_000_000)   return rtf.format(Math.round(diff / 604_800_000),    'week');
  if (abs < 31_536_000_000)  return rtf.format(Math.round(diff / 2_592_000_000),  'month');
  return                            rtf.format(Math.round(diff / 31_536_000_000), 'year');
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : (str ?? '—');
}

/* ─── Component ─── */
export default function Queue() {
  const [rows,         setRows]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState(null);
  const [actionFilter, setActionFilter] = useState('');
  const [search,       setSearch]       = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('audit_history')
        .select(`
          id, created_at, surau_id, action, user_email, surau_name,
          category, friday_prayer, public_access, location, status, address,
          image_1, image_2, image_3, image_4, reason,
          pending_approval!inner(id),
          surau(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) setFetchError(error.message);
      else       setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => rows.filter(row => {
    if (actionFilter && row.action !== actionFilter) return false;
    if (search && !getSurauName(row).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [rows, actionFilter, search]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="dash-queue-loading">
        <div className="dash-spinner" />
      </div>
    );
  }

  /* ── Fetch error ── */
  if (fetchError) {
    return (
      <div className="dash-error" style={{ marginTop: 24 }}>
        Failed to load queue: {fetchError}
      </div>
    );
  }

  const pendingCount = rows.length;

  return (
    <div className="dash-queue">
      {/* Page heading */}
      <div className="dash-page-head">
        <div>
          <h1 className="dash-page-head__title">Pending Requests</h1>
          <p className="dash-page-head__sub">
            {pendingCount === 0
              ? 'No pending requests'
              : `${pendingCount} request${pendingCount !== 1 ? 's' : ''} awaiting review`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="dash-filters">
        <select
          className="dash-select"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          aria-label="Filter by action"
        >
          {FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="dash-search-wrap">
          <span className="dash-search-icon">🔍</span>
          <input
            className="dash-search"
            type="search"
            placeholder="Search surau name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="dash-search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >✕</button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="dash-empty">
          {rows.length === 0 ? (
            <>
              <div className="dash-empty__icon">🎉</div>
              <p className="dash-empty__text">No pending requests</p>
              <p className="dash-empty__sub">You're all caught up!</p>
            </>
          ) : (
            <>
              <div className="dash-empty__icon">🔍</div>
              <p className="dash-empty__text">No results match your filter</p>
              <button
                className="dash-btn dash-btn--secondary"
                style={{ marginTop: 14 }}
                onClick={() => { setActionFilter(''); setSearch(''); }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        /* Table */
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Surau</th>
                <th>Action</th>
                <th>Submitted by</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const meta  = ACTION_META[row.action] ?? { label: row.action, cls: 'dash-chip--grey' };
                const name  = getSurauName(row);
                const email = row.user_email ?? '—';
                return (
                  <tr
                    key={row.id}
                    className="dash-table__row"
                    onClick={() => navigate(`/dashboard/${row.id}`)}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate(`/dashboard/${row.id}`)}
                  >
                    <td className="dash-table__name">{name}</td>
                    <td><span className={`dash-chip ${meta.cls}`}>{meta.label}</span></td>
                    <td className="dash-table__email" title={email}>{truncate(email, 28)}</td>
                    <td className="dash-table__time">{relativeTime(row.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
