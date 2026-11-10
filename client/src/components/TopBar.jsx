import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { initials } from '../format.js';

export default function TopBar({ children }) {
  const { user, signOut } = useAuth();
  return (
    <header className="topbar">
      <Link to="/" className="brand"><span className="logo" /> Ajaia Docs</Link>
      <div className="topbar-middle">{children}</div>
      <div className="user-chip" title={user.email}>
        <span className="avatar">{initials(user.name)}</span>
        <span className="hide-sm">{user.name}</span>
        <button className="btn ghost small" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}
