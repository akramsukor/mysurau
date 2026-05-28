import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function AuthGuard() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'authorized' | 'not-admin'
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate('/dashboard/login', { replace: true });
        return;
      }

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

    check();

    // Handle sign-out events (e.g. token expiry, manual sign-out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
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

  // Pass user down so Layout and pages can read it via useOutletContext()
  return <Outlet context={{ user }} />;
}
