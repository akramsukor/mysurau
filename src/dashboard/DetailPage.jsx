import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { supabase } from '../lib/supabase.js';
import { actionMeta } from './actionMeta.js';

/* ─── Pure helpers ─── */

// "POINT(101.679 3.022)" → { lng: 101.679, lat: 3.022 }
function parsePointText(wkt) {
  if (!wkt) return null;
  const m = wkt.match(/^POINT\(([-\d.]+)\s+([-\d.]+)\)$/);
  if (!m) return null;
  return { lng: Number(m[1]), lat: Number(m[2]) };
}

function relativeTime(iso) {
  const rtf  = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = new Date(iso).getTime() - Date.now();
  const abs  = Math.abs(diff);
  if (abs < 60_000)         return rtf.format(Math.round(diff / 1_000),          'second');
  if (abs < 3_600_000)      return rtf.format(Math.round(diff / 60_000),         'minute');
  if (abs < 86_400_000)     return rtf.format(Math.round(diff / 3_600_000),      'hour');
  if (abs < 604_800_000)    return rtf.format(Math.round(diff / 86_400_000),     'day');
  if (abs < 2_592_000_000)  return rtf.format(Math.round(diff / 604_800_000),    'week');
  if (abs < 31_536_000_000) return rtf.format(Math.round(diff / 2_592_000_000),  'month');
  return                          rtf.format(Math.round(diff / 31_536_000_000),  'year');
}

// null / '' / undefined → '—', bool → Yes/No, else String
function dv(val) {
  if (val === null || val === undefined || val === '') return '—';
  if (val === true  || val === 'true')  return 'Yes';
  if (val === false || val === 'false') return 'No';
  return String(val);
}

const REASON_LABELS = {
  doesnt_exist:       "Doesn't exist",
  duplicate:          'Duplicate surau',
  permanently_closed: 'Permanently closed',
  relocated:          'Relocated',
};
const humanizeReason = r => REASON_LABELS[r] ?? r ?? '—';

// Fields checked for " -> " diff strings in audit_history
const DIFF_FIELDS = [
  { key: 'surau_name',    label: 'Name'          },
  { key: 'category',      label: 'Category'      },
  { key: 'friday_prayer', label: 'Friday prayer' },
  { key: 'public_access', label: 'Public access' },
  { key: 'location',      label: 'Location'      },
  { key: 'status',        label: 'Status'        },
  { key: 'address',       label: 'Address'       },
  { key: 'image_1',       label: 'Image 1'       },
  { key: 'image_2',       label: 'Image 2'       },
  { key: 'image_3',       label: 'Image 3'       },
  { key: 'image_4',       label: 'Image 4'       },
  { key: 'reason',        label: 'Reason'        },
];

/* ─── Sub-components ─── */

// surauVal  — raw value from the surau row (always shown as Current)
// pendingVal — raw value from pending_approval; null means "field not touched"
function CompareRow({ label, surauVal, pendingVal }) {
  // Proposed = pending value when set, otherwise fall back to current surau value
  const proposed = (pendingVal !== null && pendingVal !== undefined) ? pendingVal : surauVal;
  // Only highlight when pending explicitly carries a value that differs from current
  const highlight = pendingVal !== null && pendingVal !== undefined
    && dv(pendingVal) !== dv(surauVal);
  return (
    <tr className={highlight ? 'dash-compare__row--diff' : ''}>
      <td className="dash-compare__field">{label}</td>
      <td className="dash-compare__val">{dv(surauVal)}</td>
      <td className="dash-compare__val">{dv(proposed)}</td>
    </tr>
  );
}

const TILE_URL = 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}@2x.png';
const RED_MARKER  = { color: '#B71C1C', fillColor: '#EF5350', fillOpacity: 0.9, weight: 2 };
const BLUE_MARKER = { color: '#0D47A1', fillColor: '#42A5F5', fillOpacity: 0.9, weight: 2 };

function SingleMap({ pt, label, markerOpts }) {
  return (
    <div>
      <p className="dash-section__subtitle">{label}</p>
      {pt ? (
        <>
          <div className="dash-map">
            <MapContainer
              center={[pt.lat, pt.lng]}
              zoom={16}
              style={{ height: 200, width: '100%' }}
              scrollWheelZoom={false}
              attributionControl={false}
            >
              <TileLayer url={TILE_URL} />
              <CircleMarker center={[pt.lat, pt.lng]} radius={9} pathOptions={markerOpts} />
            </MapContainer>
          </div>
          <p className="dash-map-coords">{pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}</p>
        </>
      ) : (
        <div className="dash-map dash-map--empty">No location data</div>
      )}
    </div>
  );
}

function DualMaps({ currentPt, proposedPt }) {
  return (
    <section className="dash-section">
      <h3 className="dash-section__title">Location</h3>
      <div className="dash-dual-maps">
        <SingleMap pt={currentPt}  label="Current location"  markerOpts={RED_MARKER}  />
        <SingleMap pt={proposedPt} label="Proposed location" markerOpts={BLUE_MARKER} />
      </div>
      {/* App.css hides Leaflet's built-in attribution globally */}
      <span className="dash-map-attr">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
        {' '}© <a href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a>
      </span>
    </section>
  );
}

function Thumb({ url, label }) {
  return url
    ? <img src={url} className="dash-image-thumb" alt={label} />
    : <div className="dash-image-empty">—</div>;
}

function ImageStrip({ images, pending }) {
  return (
    <section className="dash-section">
      <h3 className="dash-section__title">Images</h3>
      <div className="dash-images-row">
        <div className="dash-images-group">
          <p className="dash-images-group__label">Current</p>
          <div className="dash-images-group__thumbs">
            {[1, 2, 3, 4].map(n => {
              const url = images.find(i => i.position === n)?.url ?? null;
              return <Thumb key={n} url={url} label={`Current ${n}`} />;
            })}
          </div>
        </div>
        <div className="dash-images-group">
          <p className="dash-images-group__label">Proposed</p>
          <div className="dash-images-group__thumbs">
            {[1, 2, 3, 4].map(n => {
              const curUrl = images.find(i => i.position === n)?.url ?? null;
              const pendingUrl = pending[`image_${n}`] ?? null;
              // null pending = no change; fall back to current
              const displayUrl = pendingUrl ?? curUrl;
              const changed = pendingUrl !== null && pendingUrl !== curUrl;
              return (
                <div key={n} className={changed ? 'dash-image-cell--changed' : undefined}>
                  <Thumb url={displayUrl} label={`Proposed ${n}`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Main page ─── */
export default function DetailPage() {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const [loading,         setLoading]         = useState(true);
  const [busy,            setBusy]            = useState(false);
  const [error,           setError]           = useState(null);
  const [surauError,      setSurauError]      = useState(null);
  const [audit,           setAudit]           = useState(null);
  const [pending,         setPending]         = useState(null);
  const [surau,           setSurau]           = useState(null);
  const [images,          setImages]          = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason,    setRejectReason]    = useState('');
  const [rejecting,       setRejecting]       = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Step 1 — parallel: both rows are keyed on auditId
        const [auditRes, pendingRes] = await Promise.all([
          supabase.from('audit_history').select('*').eq('id', auditId).single(),
          supabase
            .from('pending_approval')
            .select('*, location_text')
            .eq('audit_history_id', auditId)
            .maybeSingle(),
        ]);

        if (auditRes.error) throw auditRes.error;
        if (!mounted) return;

        const auditData   = auditRes.data;
        const pendingData = pendingRes.data; // null = already approved/rejected

        // Step 2 — sequential: needs surau_id from audit row
        let surauData  = null;
        let imagesData = [];
        if (auditData.surau_id) {
          const surauRes = await supabase
            .from('surau')
            .select('*, location_text, surau_images(*)')
            .eq('id', auditData.surau_id)
            .single();
          if (!mounted) return;
          if (surauRes.error) {
            setSurauError(surauRes.error.message);
          } else {
            surauData  = surauRes.data;
            imagesData = surauRes.data.surau_images ?? [];
          }
        }

        if (!mounted) return;
        setAudit(auditData);
        setPending(pendingData);
        setSurau(surauData);
        setImages(imagesData);
      } catch (err) {
        if (mounted) setError(err.message ?? 'Failed to load request');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [auditId]);

  /* ── Loading ── */
  if (loading) {
    return <div className="dash-queue-loading"><div className="dash-spinner" /></div>;
  }

  /* ── Fetch error ── */
  if (error) {
    return (
      <div className="dash-detail-state">
        <div className="dash-detail-state__icon">⚠️</div>
        <p className="dash-detail-state__text">Failed to load: {error}</p>
        <Link to="/dashboard" className="dash-btn dash-btn--secondary">← Back to queue</Link>
      </div>
    );
  }

  /* ── Surau fetch error (separate from 404 — easier to diagnose) ── */
  if (surauError) {
    return (
      <div className="dash-detail-state">
        <div className="dash-detail-state__icon">⚠️</div>
        <p className="dash-detail-state__text">Failed to load surau details — {surauError}</p>
        <Link to="/dashboard" className="dash-btn dash-btn--secondary">← Back to queue</Link>
      </div>
    );
  }

  /* ── 404 / already resolved ── */
  if (!audit || !pending) {
    return (
      <div className="dash-detail-state">
        <div className="dash-detail-state__icon">🔍</div>
        <p className="dash-detail-state__text">Request not found or already resolved.</p>
        <Link to="/dashboard" className="dash-btn dash-btn--secondary">← Back to queue</Link>
      </div>
    );
  }

  /* ── Derived data ── */
  const meta       = actionMeta(pending.action);
  const currentPt  = parsePointText(surau?.location_text);
  // Fall back to current location when pending has no location change
  const proposedPt = pending.location_text != null ? parsePointText(pending.location_text) : currentPt;
  const activeDiffs = DIFF_FIELDS.filter(({ key }) => {
    const v = audit[key];
    return v !== null && v !== undefined && String(v).includes(' -> ');
  });

  async function onApprove() {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ auditId: Number(auditId) }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Approve failed');
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      alert(err.message || 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    setRejecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ auditId: Number(auditId), reason: rejectReason.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Reject failed');
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      alert(err.message || 'Reject failed');
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="dash-detail">
    <div className="dash-detail-content">

      {/* ── Top bar ── */}
      <div className="dash-detail-bar">
        <Link to="/dashboard" className="dash-detail-bar__back">← Queue</Link>
        <div className="dash-detail-bar__info">
          <span className={`dash-chip ${meta.chipCls}`}>{meta.label}</span>
          <code className="dash-detail-bar__surau-id">Surau #{audit.surau_id}</code>
          <code className="dash-detail-bar__id">#{auditId}</code>
          <span className="dash-detail-bar__email">{audit.user_email ?? '—'}</span>
          <span className="dash-detail-bar__time">
            Submitted {relativeTime(audit.created_at)}
          </span>
        </div>
      </div>

      {/* ── Delete reason banner ── */}
      {pending.action === 'request_delete' && audit.reason && (
        <div className="dash-detail-reason">
          <span className="dash-detail-reason__icon">⚠</span>
          <span><strong>Submitter reason:</strong> {humanizeReason(audit.reason)}</span>
        </div>
      )}

      {/* ── Compare table ── */}
      <section className="dash-section">
        <h3 className="dash-section__title">Comparison</h3>
        <div className="dash-compare-wrap">
          <table className="dash-compare">
            <thead>
              <tr>
                <th className="dash-compare__th">Field</th>
                <th className="dash-compare__th">Current</th>
                <th className="dash-compare__th">Proposed</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Name"          surauVal={surau?.name}          pendingVal={pending.name} />
              <CompareRow label="Category"      surauVal={surau?.category}       pendingVal={pending.category} />
              <CompareRow label="Address"       surauVal={surau?.address}        pendingVal={pending.address} />
              <CompareRow label="Friday prayer" surauVal={surau?.friday_prayer}  pendingVal={pending.friday_prayer} />
              <CompareRow label="Public access" surauVal={surau?.public_access}  pendingVal={pending.public_access} />
              <CompareRow label="Status"        surauVal={surau?.status}         pendingVal={pending.status} />
              <CompareRow label="Latitude"
                surauVal={currentPt?.lat}
                pendingVal={pending.location_text != null ? proposedPt?.lat : null}
              />
              <CompareRow label="Longitude"
                surauVal={currentPt?.lng}
                pendingVal={pending.location_text != null ? proposedPt?.lng : null}
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Map ── */}
      <DualMaps currentPt={currentPt} proposedPt={proposedPt} />

      {/* ── Image strip ── */}
      <ImageStrip images={images} pending={pending} />

      {/* ── Raw audit diff (collapsible) ── */}
      {activeDiffs.length > 0 && (
        <section className="dash-section">
          <details className="dash-diff-details">
            <summary className="dash-diff-summary">Raw audit diff</summary>
            <div className="dash-diff-body">
              {activeDiffs.map(({ key, label }) => (
                <div key={key} className="dash-diff-line">
                  <span className="dash-diff-key">{label}:</span>
                  <span className="dash-diff-val">{audit[key]}</span>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

    </div>

    <div className="dash-footer">
      <button
        className="dash-btn dash-btn--secondary"
        disabled={busy || rejecting}
        onClick={() => setShowRejectModal(true)}
      >
        Reject
      </button>
      <button
        className="dash-btn dash-btn--approve"
        disabled={busy || rejecting}
        onClick={onApprove}
      >
        {busy ? 'Approving…' : 'Approve ✓'}
      </button>
    </div>

    {/* ── Reject confirmation modal ── */}
    {showRejectModal && (
      <div
        className="dash-modal-overlay"
        onClick={() => !rejecting && setShowRejectModal(false)}
      >
        <div className="dash-modal" onClick={e => e.stopPropagation()}>
          <h3 className="dash-modal__title">Reject this request?</h3>
          <p className="dash-modal__sub">
            The surau will not be changed. This action can't be undone.
          </p>
          <div className="dash-field">
            <label className="dash-field__label" htmlFor="reject-reason">
              Reason for rejection (optional)
            </label>
            <textarea
              id="reject-reason"
              className="dash-field__input dash-field__input--textarea"
              rows={3}
              maxLength={200}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Incorrect information, duplicate entry…"
              disabled={rejecting}
            />
            <p className="dash-field__count">{rejectReason.length}/200</p>
          </div>
          <div className="dash-modal__actions">
            <button
              className="dash-btn dash-btn--secondary"
              onClick={() => setShowRejectModal(false)}
              disabled={rejecting}
            >
              Cancel
            </button>
            <button
              className="dash-btn dash-btn--reject"
              onClick={onReject}
              disabled={rejecting}
            >
              {rejecting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      </div>
    )}

  </div>
  );
}
