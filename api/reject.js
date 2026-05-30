import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const supabaseAnon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const REJECTED_ACTION = {
  request_add:    'rejected_add',
  request_change: 'rejected_change',
  request_delete: 'rejected_delete',
};

function pointToLatLon(wkt) {
  if (!wkt) return null;
  const inner = wkt.replace('POINT(', '').replace(')', '');
  const [lon, lat] = inner.split(' ');
  return `${lat},${lon}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Step 1 — Verify the caller is an authenticated admin (same pattern as approve.js)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth' });

    const { data: { user }, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('admin')
      .eq('id', user.id)
      .single();
    if (!profile?.admin) return res.status(403).json({ error: 'Not authorized' });

    const adminUserId = user.id;
    const adminEmail  = user.email;

    // Step 2 — Parse body
    const { auditId, reason } = req.body;
    if (!auditId) return res.status(400).json({ error: 'Missing auditId' });
    const sanitizedReason = reason ? String(reason).trim().slice(0, 200) || null : null;

    // Step 3 — Fetch the pending row to get action type + payload
    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from('pending_approval')
      .select('*, location_text')
      .eq('audit_history_id', auditId)
      .single();
    if (pendingErr || !pending) {
      return res.status(404).json({ error: 'Pending row not found (already resolved?)' });
    }

    const rejectedAction = REJECTED_ACTION[pending.action];
    if (!rejectedAction) {
      return res.status(400).json({ error: `Cannot reject action: ${pending.action}` });
    }

    // Step 4 — Write the rejection audit row.
    // Snapshots the rejected payload so it stays queryable after pending is deleted.
    // Note: sequential (not transactional). If the delete below fails, the audit row
    // will remain as an orphan — acceptable; the pending row will still show in the queue.
    const { error: auditErr } = await supabaseAdmin.from('audit_history').insert({
      surau_id:      pending.surau_id,
      user_id:       adminUserId,
      user_email:    adminEmail,
      action:        rejectedAction,
      reason:        sanitizedReason, // admin's rejection reason
      // Snapshot of what was being proposed (mirrors the pending payload structure)
      surau_name:    pending.name,
      category:      pending.category,
      friday_prayer: pending.friday_prayer != null ? String(pending.friday_prayer) : null,
      public_access: pending.public_access != null ? String(pending.public_access) : null,
      location:      pointToLatLon(pending.location_text),
      status:        pending.status,
      address:       pending.address || null,
      image_1:       pending.image_1 || null,
      image_2:       pending.image_2 || null,
      image_3:       pending.image_3 || null,
      image_4:       pending.image_4 || null,
    });
    if (auditErr) throw auditErr;

    // Step 5 — Hard-delete the pending_approval row (surau row is NOT touched)
    const { error: deleteErr } = await supabaseAdmin
      .from('pending_approval')
      .delete()
      .eq('id', pending.id);
    if (deleteErr) throw deleteErr;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('reject handler error:', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
}
