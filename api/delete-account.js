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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the caller is an authenticated user
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth' });

    const { data: { user }, error: userErr } = await supabaseAnon.auth.getUser(token);
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' });

    // Delete from profiles first (in case FK doesn't cascade)
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', user.id);

    // Delete the auth user — this removes them from auth.users entirely,
    // so the email is free to be re-registered with any provider.
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteErr) throw deleteErr;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete-account handler error:', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
}
