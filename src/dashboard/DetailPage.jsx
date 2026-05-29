import { useEffect, useState, Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
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

function CompareRow({ label, current, proposed }) {
  const changed = current !== proposed;
  return (
    <tr className={changed ? 'dash-compare__row--diff' : ''}>
      <td className="dash-compare__field">{label}</td>
      <td className="dash-compare__val">{current}</td>
      <td className="dash-compare__val">{proposed}</td>
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

function ImageStrip({ images, pending }) {
  return (
    <section className="dash-section">
      <h3 className="dash-section__title">Images</h3>
      <div className="dash-images-grid">
        {/* Column headers */}
        <div className="dash-images-col-head">Current</div>
        <div className="dash-images-col-head">Proposed</div>

        {/* 4 rows — position badge on the left (current) cell only */}
        {[1, 2, 3, 4].map(n => {
          const curUrl = images.find(i => i.position === n)?.url ?? null;
          const proUrl = pending[`image_${n}`] ?? null;
          return (
            <Fragment key={n}>
              <div className="dash-image-cell">
                <span className="dash-image-cell__pos">{n}</span>
                {curUrl
                  ? <img src={curUrl} className="dash-image-thumb" alt={`Current ${n}`} />
                  : <div className="dash-image-empty">—</div>}
              </div>
              <div className="dash-image-cell">
                {proUrl
                  ? <img src={proUrl} className="dash-image-thumb" alt={`Proposed ${n}`} />
                  : <div className="dash-image-empty">—</div>}
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Main page ─── */
export default function DetailPage() {
  const { auditId } = useParams();
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);   // audit/pending fetch failure
  const [surauError, setSurauError] = useState(null);   // surau fetch failure (separate diagnosis)
  const [audit,      setAudit]      = useState(null);
  const [pending,    setPending]    = useState(null);
  const [surau,      setSurau]      = useState(null);
  const [images,     setImages]     = useState([]);

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
  const proposedPt = parsePointText(pending.location_text);
  const activeDiffs = DIFF_FIELDS.filter(({ key }) => {
    const v = audit[key];
    return v !== null && v !== undefined && String(v).includes(' -> ');
  });

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
              <CompareRow label="Name"          current={dv(surau?.name)}          proposed={dv(pending.name)} />
              <CompareRow label="Category"      current={dv(surau?.category)}       proposed={dv(pending.category)} />
              <CompareRow label="Address"       current={dv(surau?.address)}        proposed={dv(pending.address)} />
              <CompareRow label="Friday prayer" current={dv(surau?.friday_prayer)}  proposed={dv(pending.friday_prayer)} />
              <CompareRow label="Public access" current={dv(surau?.public_access)}  proposed={dv(pending.public_access)} />
              <CompareRow label="Status"        current={dv(surau?.status)}         proposed={dv(pending.status)} />
              <CompareRow label="Latitude"      current={dv(currentPt?.lat)}        proposed={dv(proposedPt?.lat)} />
              <CompareRow label="Longitude"     current={dv(currentPt?.lng)}        proposed={dv(proposedPt?.lng)} />
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
        onClick={() => {
          console.log('reject', auditId);
          alert('Reject handler coming in Slice 6');
        }}
      >
        Reject
      </button>
      <button
        className="dash-btn dash-btn--approve"
        onClick={() => {
          console.log('approve', auditId);
          alert('Approve handler coming in Slice 5');
        }}
      >
        Approve ✓
      </button>
    </div>

  </div>
  );
}
