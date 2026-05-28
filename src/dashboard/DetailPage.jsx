import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { supabase } from '../lib/supabase.js';
import { actionMeta } from './actionMeta.js';

/* ─── Pure helpers ─── */

// ST_AsText returns "POINT(lon lat)"
function parsePoint(wkt) {
  if (!wkt) return null;
  const m = wkt.match(/POINT\(([^\s]+)\s+([^)]+)\)/);
  return m ? { lon: parseFloat(m[1]), lat: parseFloat(m[2]) } : null;
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

function DetailMap({ currentPt, proposedPt }) {
  const hasCur = currentPt != null;
  const hasPro = proposedPt != null;
  if (!hasCur && !hasPro) return null;

  const same = hasCur && hasPro &&
    currentPt.lat === proposedPt.lat && currentPt.lon === proposedPt.lon;

  const mapProps = (hasCur && hasPro && !same)
    ? { bounds: [[currentPt.lat, currentPt.lon], [proposedPt.lat, proposedPt.lon]],
        boundsOptions: { padding: [48, 48] } }
    : { center: [(hasCur ? currentPt : proposedPt).lat, (hasCur ? currentPt : proposedPt).lon],
        zoom: 15 };

  return (
    <section className="dash-section">
      <h3 className="dash-section__title">Location</h3>
      <div className="dash-map">
        <MapContainer
          {...mapProps}
          style={{ height: 280, width: '100%' }}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url={TILE_URL} />
          {hasCur && (
            <CircleMarker
              center={[currentPt.lat, currentPt.lon]}
              radius={9}
              pathOptions={{ color: '#B71C1C', fillColor: '#EF5350', fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>Current location</Popup>
            </CircleMarker>
          )}
          {hasPro && !same && (
            <CircleMarker
              center={[proposedPt.lat, proposedPt.lon]}
              radius={9}
              pathOptions={{ color: '#0D47A1', fillColor: '#42A5F5', fillOpacity: 0.9, weight: 2 }}
            >
              <Popup>Proposed location</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      <div className="dash-map-footer">
        <span className="dash-map-legend">
          <span className="dash-map-legend__dot dash-map-legend__dot--red" /> Current
          {hasPro && !same && (
            <>&nbsp;&nbsp;<span className="dash-map-legend__dot dash-map-legend__dot--blue" /> Proposed</>
          )}
        </span>
        {/* App.css hides Leaflet's attribution control globally, so render it manually */}
        <span className="dash-map-attr">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
          {' '}© <a href="https://carto.com/" target="_blank" rel="noreferrer">CARTO</a>
        </span>
      </div>
    </section>
  );
}

function ImageStrip({ images, pending }) {
  return (
    <section className="dash-section">
      <h3 className="dash-section__title">Images</h3>
      <div className="dash-images">
        {[1, 2, 3, 4].map(n => {
          const curUrl = images.find(i => i.position === n)?.url ?? null;
          const proUrl = pending[`image_${n}`] ?? null;
          return (
            <div key={n} className="dash-image-col">
              <p className="dash-image-col__label">Image {n}</p>
              <div className="dash-image-slot">
                <p className="dash-image-slot__sub">Current</p>
                {curUrl
                  ? <img src={curUrl} className="dash-image-thumb" alt={`Current image ${n}`} />
                  : <div className="dash-image-empty">—</div>}
              </div>
              <div className="dash-image-slot">
                <p className="dash-image-slot__sub">Proposed</p>
                {proUrl
                  ? <img src={proUrl} className="dash-image-thumb" alt={`Proposed image ${n}`} />
                  : <div className="dash-image-empty">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Main page ─── */
export default function DetailPage() {
  const { auditId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [audit,   setAudit]   = useState(null);
  const [pending, setPending] = useState(null);
  const [surau,   setSurau]   = useState(null);
  const [images,  setImages]  = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // Step 1 — parallel: both rows are keyed on auditId
        const [auditRes, pendingRes] = await Promise.all([
          supabase.from('audit_history').select('*').eq('id', auditId).single(),
          supabase
            .from('pending_approval')
            .select('*, location_text:ST_AsText(location::geometry)')
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
            .select('*, location_text:ST_AsText(location::geometry), surau_images(*)')
            .eq('id', auditData.surau_id)
            .single();
          if (!mounted) return;
          if (!surauRes.error) {
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
  const currentPt  = parsePoint(surau?.location_text);
  const proposedPt = parsePoint(pending.location_text);
  const activeDiffs = DIFF_FIELDS.filter(({ key }) => {
    const v = audit[key];
    return v !== null && v !== undefined && String(v).includes(' -> ');
  });

  return (
    <div className="dash-detail">

      {/* ── Top bar ── */}
      <div className="dash-detail-bar">
        <Link to="/dashboard" className="dash-detail-bar__back">← Queue</Link>
        <div className="dash-detail-bar__info">
          <span className={`dash-chip ${meta.chipCls}`}>{meta.label}</span>
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
              <CompareRow label="Longitude"     current={dv(currentPt?.lon)}        proposed={dv(proposedPt?.lon)} />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Map ── */}
      <DetailMap currentPt={currentPt} proposedPt={proposedPt} />

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

      {/* Spacer so footer doesn't overlap last section */}
      <div style={{ height: 76 }} />

      {/* ── Sticky footer ── */}
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
