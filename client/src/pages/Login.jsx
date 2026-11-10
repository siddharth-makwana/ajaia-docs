import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

const DEMO = [
  { email: 'alice@ajaia.dev', name: 'Alice Chen', note: 'Owns the Welcome doc' },
  { email: 'bob@ajaia.dev', name: 'Bob Patel', note: 'Editor on Welcome doc' },
  { email: 'carol@ajaia.dev', name: 'Carol Diaz', note: 'Nothing shared yet' },
];
const DEMO_PASSWORD = 'password123';

export default function Login() {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e, p) {
    setBusy(true);
    setError('');
    try {
      const { user } = await api.login(e, p);
      setUser(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand brand-lg"><span className="logo" /> Ajaia Docs</div>
        <p className="muted">Sign in to create, edit and share documents.</p>
        <form onSubmit={(ev) => { ev.preventDefault(); signIn(email, password); }}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="divider"><span>or use a demo account</span></div>
        <div className="demo-list">
          {DEMO.map((u) => (
            <button key={u.email} className="demo-user" disabled={busy} onClick={() => signIn(u.email, DEMO_PASSWORD)}>
              <strong>{u.name}</strong>
              <span className="muted small">{u.email} · {u.note}</span>
            </button>
          ))}
        </div>
        <p className="muted small">All demo accounts use the password <code>{DEMO_PASSWORD}</code>.</p>
      </div>
    </div>
  );
}
