import { createClient } from '@supabase/supabase-js';

// Admin client — service role key, never exposed to the browser.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Anon client — used only to verify the caller's JWT.
const supabaseAnon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/* ─── Helpers ─── */

// Produces "old -> new" diff string, or null when values are equal.
function diff(oldVal, newVal) {
  const o = (oldVal ?? '').toString().trim();
  const n = (newVal ?? '').toString().trim();
  if (o === n) return null;
  const od = o === '' ? '(empty)' : o;
  return n === '' ? `${od} -> deleted` : `${od} -> ${n}`;
}

// Converts "POINT(101.679 3.022)" → "3.022,101.679" (lat,lon) for audit_history text columns.
function pointToLatLon(wkt) {
  if (!wkt) return null;
  const inner = wkt.replace('POINT(', '').replace(')', '');
  const [lon, lat] = inner.split(' ');
  return `${lat},${lon}`;
}

// Downloads a suggestion_*.webp, re-uploads to surau_<id>_<pos>.webp,
// upserts the surau_images row, and deletes the original suggestion file.
async function promoteSuggestionImage(suggestionUrl, surauId, position) {
  const path = suggestionUrl.split('/surau_images/')[1]?.split('?')[0];
  if (!path?.startsWith('suggestion_')) return null;

  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from('surau_images')
    .download(path);
  if (dlErr) throw dlErr;

  const liveName = `surau_${surauId}_${position}.webp`;
  await supabaseAdmin.storage
    .from('surau_images')
    .upload(liveName, blob, { contentType: 'image/webp', upsert: true });

  const cacheBuster = Math.floor(Date.now() / 1000);
  const publicUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/surau_images/${liveName}?v=${cacheBuster}`;

  await supabaseAdmin.from('surau_images').upsert(
    { surau_id: surauId, position, url: publicUrl },
    { onConflict: 'surau_id,position' }
  );

  await supabaseAdmin.storage.from('surau_images').remove([path]);

  return publicUrl;
}

/* ─── Action handlers ─── */

async function handleRequestAdd(pending, adminUserId, adminEmail) {
  await supabaseAdmin.from('surau').update({ approved: true }).eq('id', pending.surau_id);
  await supabaseAdmin.from('pending_approval').delete().eq('id', pending.id);
  await supabaseAdmin.from('audit_history').insert({
    surau_id:     pending.surau_id,
    user_id:      adminUserId,
    user_email:   adminEmail,
    action:       'add',
    surau_name:   pending.name,
    category:     pending.category,
    friday_prayer: String(pending.friday_prayer ?? ''),
    public_access: String(pending.public_access ?? ''),
    location:     pointToLatLon(pending.location_text),
    status:       pending.status,
    address:      pending.address || null,
  });
}

async function handleRequestChange(pending, adminUserId, adminEmail) {
  // Fetch current surau snapshot before mutating
  const { data: cur } = await supabaseAdmin
    .from('surau')
    .select('*, location_text, surau_images(*)')
    .eq('id', pending.surau_id)
    .single();

  const curImages = cur?.surau_images ?? [];

  // Promote suggestion images; track new live URLs for the diff
  const promotedUrls = {};
  for (const pos of [1, 2, 3, 4]) {
    const proposedUrl = pending[`image_${pos}`];
    if (proposedUrl?.includes('suggestion_')) {
      try {
        promotedUrls[pos] = await promoteSuggestionImage(proposedUrl, pending.surau_id, pos);
      } catch (err) {
        console.error(`Image promotion failed for position ${pos}:`, err);
        // Non-fatal — continue with the rest of the approval
      }
    }
  }

  // Apply surau row update (all fields from the pending snapshot)
  await supabaseAdmin.from('surau').update({
    name:          pending.name,
    category:      pending.category,
    address:       pending.address,
    friday_prayer: pending.friday_prayer,
    public_access: pending.public_access,
    status:        pending.status,
    location:      pending.location, // raw geography WKB — copy directly
  }).eq('id', pending.surau_id);

  await supabaseAdmin.from('pending_approval').delete().eq('id', pending.id);

  // Build diff strings for the audit row
  const curLoc = pointToLatLon(cur?.location_text);
  const newLoc = pointToLatLon(pending.location_text);

  function curImageUrl(pos) { return curImages.find(i => i.position === pos)?.url ?? ''; }
  function newImageUrl(pos) { return promotedUrls[pos] ?? pending[`image_${pos}`] ?? ''; }

  await supabaseAdmin.from('audit_history').insert({
    surau_id:      pending.surau_id,
    user_id:       adminUserId,
    user_email:    adminEmail,
    action:        'change',
    surau_name:    diff(cur?.name,             pending.name),
    category:      diff(cur?.category,         pending.category),
    friday_prayer: diff(cur?.friday_prayer,    pending.friday_prayer),
    public_access: diff(cur?.public_access,    pending.public_access),
    location:      diff(curLoc,                newLoc),
    status:        diff(cur?.status,           pending.status),
    address:       diff(cur?.address,          pending.address),
    image_1:       diff(curImageUrl(1),        newImageUrl(1)),
    image_2:       diff(curImageUrl(2),        newImageUrl(2)),
    image_3:       diff(curImageUrl(3),        newImageUrl(3)),
    image_4:       diff(curImageUrl(4),        newImageUrl(4)),
  });
}

async function handleRequestDelete(pending, adminUserId, adminEmail) {
  // Snapshot the surau before deletion
  const { data: cur } = await supabaseAdmin
    .from('surau')
    .select('*, location_text, surau_images(*)')
    .eq('id', pending.surau_id)
    .single();

  const curImages = cur?.surau_images ?? [];

  // Best-effort: delete each image file from storage
  for (const img of curImages) {
    try {
      const path = img.url.split('/surau_images/')[1]?.split('?')[0];
      if (path) await supabaseAdmin.storage.from('surau_images').remove([path]);
    } catch (err) {
      console.error('Storage file delete failed:', err);
    }
  }

  // Delete the surau (cascades surau_images rows if FK cascade is set;
  // explicit delete below handles the case where it isn't)
  await supabaseAdmin.from('surau_images').delete().eq('surau_id', pending.surau_id);
  await supabaseAdmin.from('surau').delete().eq('id', pending.surau_id);
  await supabaseAdmin.from('pending_approval').delete().eq('id', pending.id);

  await supabaseAdmin.from('audit_history').insert({
    surau_id:      pending.surau_id,
    user_id:       adminUserId,
    user_email:    adminEmail,
    action:        'delete',
    surau_name:    cur?.name,
    category:      cur?.category,
    friday_prayer: String(cur?.friday_prayer ?? ''),
    public_access: String(cur?.public_access ?? ''),
    location:      pointToLatLon(cur?.location_text),
    status:        cur?.status,
    address:       cur?.address || null,
    reason:        pending.reason,
  });
}

/* ─── Route handler ─── */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Step 1 — Verify the caller is an authenticated admin
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

    // Step 2 — Parse and validate the request body
    const { auditId } = req.body;
    if (!auditId) return res.status(400).json({ error: 'Missing auditId' });

    const { data: audit, error: auditErr } = await supabaseAdmin
      .from('audit_history')
      .select('*')
      .eq('id', auditId)
      .single();
    if (auditErr || !audit) return res.status(404).json({ error: 'Audit row not found' });

    const { data: pending, error: pendingErr } = await supabaseAdmin
      .from('pending_approval')
      .select('*, location_text')
      .eq('audit_history_id', auditId)
      .single();
    if (pendingErr || !pending) {
      return res.status(404).json({ error: 'Pending row not found (already resolved?)' });
    }

    // Step 3 — Branch on action
    if (pending.action === 'request_add') {
      await handleRequestAdd(pending, adminUserId, adminEmail);
    } else if (pending.action === 'request_change') {
      await handleRequestChange(pending, adminUserId, adminEmail);
    } else if (pending.action === 'request_delete') {
      await handleRequestDelete(pending, adminUserId, adminEmail);
    } else {
      return res.status(400).json({ error: `Unknown action: ${pending.action}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('approve handler error:', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
}
