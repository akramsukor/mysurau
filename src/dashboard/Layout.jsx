import { useEffect } from 'react';
import { Link, Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Layout() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  // App.css sets overflow:hidden on BOTH html and body for the map page.
  // Both elements need the override class or html clips the body scroll.
  useEffect(() => {
    document.documentElement.classList.add('dashboard-page');
    document.body.classList.add('dashboard-page');
    return () => {
      document.documentElement.classList.remove('dashboard-page');
      document.body.classList.remove('dashboard-page');
    };
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
