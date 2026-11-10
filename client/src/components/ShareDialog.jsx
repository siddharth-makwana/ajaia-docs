import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { initials } from '../format.js';

export default function ShareDialog({ doc, onClose }) {
  const [shares, setShares] = useState([]);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.shares(doc.id).then((r) => setShares(r.shares)).catch((e) => setError(e.message));
    api.users().then((r) => setUsers(r.users)).catch(() => {});
  }, [doc.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      setShares(r.shares);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const add = async (e) => {
    e.preventDefault();
    if (await run(() => api.share(doc.id, email, role))) setEmail('');
  };

  const sharedIds = new Set(shares.map((s) => s.user_id));
  const suggestions = users.filter((u) => !sharedIds.has(u.id));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share “{doc.title}”</h2>
        <form className="share-form" onSubmit={add}>
          <input
            type="email"
            placeholder="Add people by email"
            list="share-users"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <datalist id="share-users">
            {suggestions.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Access level">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button className="btn primary" disabled={busy || !email}>Share</button>
        </form>
        {suggestions.length > 0 && (
          <p className="muted small">Demo users: {suggestions.map((u) => (
            <button key={u.id} type="button" className="link" onClick={() => setEmail(u.email)}>{u.email}</button>
          )).reduce((a, b) => [a, ', ', b])}</p>
        )}
        {error && <div className="error" role="alert">{error}</div>}

        <h3>People with access</h3>
        <ul className="share-list">
          <li>
            <span className="avatar">{initials(doc.owner.name)}</span>
            <span className="grow">{doc.owner.name} <span className="muted small">{doc.owner.email}</span></span>
            <span className="muted">Owner</span>
          </li>
          {shares.map((s) => (
            <li key={s.user_id}>
              <span className="avatar">{initials(s.name)}</span>
              <span className="grow">{s.name} <span className="muted small">{s.email}</span></span>
              <select value={s.role} disabled={busy} aria-label={`Access for ${s.name}`}
                onChange={(e) => run(() => api.share(doc.id, s.email, e.target.value))}>
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button className="btn ghost small danger" disabled={busy} onClick={() => run(() => api.unshare(doc.id, s.user_id))}>Remove</button>
            </li>
          ))}
        </ul>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
