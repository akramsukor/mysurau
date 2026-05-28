import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function AuthGuard() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'authorized' | 'not-admin'
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    // Guard against double-execution: INITIAL_SESSION and SIGNED_IN both fire on OAuth redirect.
    let checked = false;

    async function checkAdmin(session) {
      if (!mounted || checked) return;
      checked = true;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('admin')
        .eq('id', session.user.id)
        .single();

      if (!mounted) return;

      if (error || !profile?.admin) {
        setStatus('not-admin');
        return;
      }

      setUser(session.user);
      setStatus('authorized');
    }

    // onAuthStateChange is the single source of truth:
    // - INITIAL_SESSION fires after Supabase resolves the URL (including PKCE OAuth exchange),
    //   so it always carries the correct post-redirect session state.
    // - SIGNED_IN fires alongside INITIAL_SESSION on OAuth redirect (handled by `checked` guard).
    // - SIGNED_OUT covers tab-level token expiry and sign-out from other tabs.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session) {
          navigate('/dashboard/login', { replace: true });
        } else {
          checkAdmin(session);
        }
      } else if (event === 'SIGNED_IN' && session) {
        checkAdmin(session);
      } else if (event === 'SIGNED_OUT') {
        navigate('/dashboard/login', { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
      </div>
    );
  }

  if (status === 'not-admin') {
    return (
      <div className="dash-blocked">
        <div className="dash-blocked__card">
          <div className="dash-blocked__icon">🔒</div>
          <h2 className="dash-blocked__title">Access Denied</h2>
          <p className="dash-blocked__body">
            This account does not have admin access to the MySurau dashboard.
          </p>
          <button
            className="dash-btn dash-btn--secondary"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <Outlet context={{ user }} />;
}
