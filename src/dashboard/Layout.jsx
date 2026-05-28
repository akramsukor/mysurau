import { useEffect } from 'react';
import { Link, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Layout() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  // Override App.css's overflow:hidden on html/body (set for the map page)
  useEffect(() => {
    document.body.classList.add('dashboard-page');
    return () => document.body.classList.remove('dashboard-page');
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/dashboard/login', { replace: true });
  }

  return (
    <div className="dash-layout">
      <header className="dash-header">
        <Link to="/dashboard" className="dash-header__brand">
          <span className="dash-header__icon">🕌</span>
          <span className="dash-header__name">MySurau</span>
          <span className="dash-header__badge">Admin</span>
        </Link>
        <div className="dash-header__right">
          <span className="dash-header__email">{user?.email}</span>
          <button className="dash-btn dash-btn--outline-sm" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="dash-main">
        {/* Pass user further down for Queue / DetailPage */}
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
