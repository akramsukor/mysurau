import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Override body overflow (same fix as Layout) + redirect if already signed in as admin
  useEffect(() => {
    document.body.classList.add('dashboard-page');

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('admin')
        .eq('id', session.user.id)
        .single();
      if (profile?.admin) navigate('/dashboard', { replace: true });
    });

    return () => document.body.classList.remove('dashboard-page');
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Guard: confirm this account is actually admin before granting access
    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile } = await supabase
      .from('profiles')
      .select('admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.admin) {
      await supabase.auth.signOut();
      setError('This account does not have admin access.');
      setLoading(false);
      return;
    }

    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="dash-login">
      <div className="dash-login__card">
        <div className="dash-login__header">
          <span className="dash-login__icon">🕌</span>
          <h1 className="dash-login__title">MySurau</h1>
          <p className="dash-login__subtitle">Admin Dashboard</p>
        </div>

        <form className="dash-login__form" onSubmit={handleSubmit} noValidate>
          <div className="dash-field">
            <label className="dash-field__label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="dash-field__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="dash-field">
            <label className="dash-field__label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="dash-field__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="dash-error">{error}</div>}

          <button
            className="dash-btn dash-btn--primary dash-btn--full"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
