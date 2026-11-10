import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import TopBar from '../components/TopBar.jsx';
import { timeAgo } from '../format.js';

const ACCEPT = '.txt,.md,.markdown,.docx';

export default function Dashboard() {
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [docs, setDocs] = useState(null);
  const [tab, setTab] = useState('owned');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.listDocs().then(setDocs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function createDoc() {
    setBusy(true);
    try {
      const { document } = await api.createDoc({ title: 'Untitled document' });
      navigate(`/d/${document.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function importFile(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { document } = await api.importDoc(file);
      navigate(`/d/${document.id}`);
    } catch (e) {
      setError(`Import failed: ${e.message}`);
      setBusy(false);
    } finally {
      fileInput.current.value = '';
    }
  }

  async function remove(doc) {
    if (!window.confirm(`Delete "${doc.title}"? This also removes access for anyone it's shared with.`)) return;
    try {
      await api.deleteDoc(doc.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const list = docs ? docs[tab] : [];

  return (
    <>
      <TopBar />
      <main className="dashboard">
        <section className="actions">
          <button className="new-card" onClick={createDoc} disabled={busy}>
            <span className="plus">+</span>
            <strong>Blank document</strong>
          </button>
          <button className="new-card" onClick={() => fileInput.current.click()} disabled={busy}>
            <span className="plus">⇪</span>
            <strong>Import a file</strong>
            <span className="muted small">.txt, .md or .docx · max 2 MB</span>
          </button>
          <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => importFile(e.target.files[0])} />
        </section>

        {error && <div className="error" role="alert">{error} <button className="link" onClick={() => setError('')}>Dismiss</button></div>}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'owned'} className={tab === 'owned' ? 'active' : ''} onClick={() => setTab('owned')}>
            Owned by me {docs && <span className="count">{docs.owned.length}</span>}
          </button>
          <button role="tab" aria-selected={tab === 'shared'} className={tab === 'shared' ? 'active' : ''} onClick={() => setTab('shared')}>
            Shared with me {docs && <span className="count">{docs.shared.length}</span>}
          </button>
        </div>

        {!docs ? (
          <p className="muted">Loading…</p>
        ) : list.length === 0 ? (
          <div className="empty">
            {tab === 'owned'
              ? 'You have no documents yet. Create one or import a file above.'
              : 'Nothing has been shared with you yet.'}
          </div>
        ) : (
          <ul className="doc-list">
            {list.map((d) => (
              <li key={d.id}>
                <Link to={`/d/${d.id}`} className="doc-row">
                  <span className="doc-icon" aria-hidden />
                  <span className="doc-title">{d.title}</span>
                  {tab === 'owned' ? (
                    <span className="muted small">{d.share_count > 0 ? `Shared with ${d.share_count}` : 'Private'}</span>
                  ) : (
                    <span className="muted small">
                      Owner: {d.owner_name} <span className={`badge ${d.role}`}>{d.role === 'editor' ? 'Can edit' : 'View only'}</span>
                    </span>
                  )}
                  <span className="muted small nowrap">Edited {timeAgo(d.updated_at)}</span>
                </Link>
                {tab === 'owned' && (
                  <button className="btn ghost small danger" onClick={() => remove(d)} aria-label={`Delete ${d.title}`}>Delete</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
