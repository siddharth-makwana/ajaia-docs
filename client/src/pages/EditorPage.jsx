import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { api } from '../api.js';
import TopBar from '../components/TopBar.jsx';
import Toolbar from '../components/Toolbar.jsx';
import ShareDialog from '../components/ShareDialog.jsx';
import { timeAgo } from '../format.js';

const AUTOSAVE_MS = 800;

export default function EditorPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDoc(null);
    setError(null);
    api.getDoc(id).then((r) => setDoc(r.document)).catch(setError);
  }, [id]);

  if (error) {
    return (
      <>
        <TopBar />
        <div className="center">
          <h2>{error.status === 404 ? 'Document not found' : 'Could not open document'}</h2>
          <p className="muted">{error.status === 404 ? "It may have been deleted, or it hasn't been shared with you." : error.message}</p>
          <Link className="btn" to="/">Back to documents</Link>
        </div>
      </>
    );
  }
  if (!doc) return <><TopBar /><div className="center muted">Loading document…</div></>;
  return <Workspace key={doc.id} initial={doc} />;
}

/**
 * Save model: edits are batched into `pending` and flushed after a short idle
 * period. Only one request is in flight at a time; every save sends the
 * version it is based on, so a concurrent edit by another user surfaces as a
 * 409 conflict instead of silently overwriting their work.
 */
function useAutosave(docId, initialVersion, onSaved) {
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error | conflict
  const [conflict, setConflict] = useState(null);
  const version = useRef(initialVersion);
  const pending = useRef({});
  const inFlight = useRef(false);
  const timer = useRef(null);

  const hasPending = () => Object.keys(pending.current).length > 0;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (inFlight.current || !hasPending()) return;
    const patch = pending.current;
    pending.current = {};
    inFlight.current = true;
    setStatus('saving');
    try {
      const { document } = await api.updateDoc(docId, { ...patch, version: version.current });
      version.current = document.version;
      onSaved(document);
      setStatus(hasPending() ? 'dirty' : 'saved');
    } catch (err) {
      pending.current = { ...patch, ...pending.current }; // keep unsaved work
      if (err.status === 409) {
        setConflict(err.body.document);
        setStatus('conflict');
      } else {
        setStatus('error');
      }
      inFlight.current = false;
      return;
    }
    inFlight.current = false;
    if (hasPending()) flush();
  }, [docId, onSaved]);

  const queue = useCallback((patch, { immediate = false } = {}) => {
    pending.current = { ...pending.current, ...patch };
    setStatus((s) => (s === 'conflict' ? s : 'dirty'));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, immediate ? 0 : AUTOSAVE_MS);
  }, [flush]);

  // Warn before closing the tab with unsaved work; flush when leaving the page.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (hasPending() || inFlight.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, [flush]);

  const resolveConflict = useCallback((keepMine) => {
    if (!conflict) return null;
    version.current = conflict.version;
    const latest = conflict;
    setConflict(null);
    if (keepMine) {
      setStatus('dirty');
      flush();
      return null;
    }
    pending.current = {};
    setStatus('saved');
    return latest;
  }, [conflict, flush]);

  return { status, queue, flush, conflict, resolveConflict, hasPending };
}

function Workspace({ initial }) {
  const [meta, setMeta] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [sharing, setSharing] = useState(false);
  const canEdit = initial.role !== 'viewer';
  const isOwner = initial.role === 'owner';

  const onSaved = useCallback((d) => setMeta(d), []);
  const save = useAutosave(initial.id, initial.version, onSaved);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: canEdit ? 'Start writing…' : '' }),
    ],
    content: initial.content,
    editable: canEdit,
    autofocus: canEdit && !initial.content ? 'start' : false,
    onUpdate: ({ editor: e }) => save.queue({ content: e.getHTML() }),
  });

  useEffect(() => { document.title = `${meta.title} – Ajaia Docs`; return () => { document.title = 'Ajaia Docs'; }; }, [meta.title]);

  function commitTitle() {
    const t = title.trim();
    if (!t) { setTitle(meta.title); return; }
    if (t !== meta.title) save.queue({ title: t }, { immediate: true });
  }

  function resolve(keepMine) {
    const latest = save.resolveConflict(keepMine);
    if (latest) {
      editor.commands.setContent(latest.content, { emitUpdate: false });
      setTitle(latest.title);
      setMeta(latest);
    }
  }

  async function exportAs(e, format) {
    e.preventDefault();
    await save.flush();
    window.location.href = `/api/documents/${meta.id}/export?format=${format}`;
  }

  const statusText = {
    saved: `Saved · ${timeAgo(meta.updatedAt)}`,
    dirty: 'Unsaved changes…',
    saving: 'Saving…',
    error: 'Save failed',
    conflict: 'Conflict',
  }[save.status];

  return (
    <>
      <TopBar>
        <div className="doc-header">
          <input
            className="title-input"
            value={title}
            maxLength={200}
            readOnly={!canEdit}
            aria-label="Document title"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); editor?.commands.focus(); }
              if (e.key === 'Escape') { setTitle(meta.title); e.currentTarget.blur(); }
            }}
          />
          <div className="doc-sub">
            {canEdit ? (
              <span className={`save-status ${save.status}`} aria-live="polite">
                {statusText}
                {save.status === 'error' && <button className="link" onClick={save.flush}>Retry</button>}
              </span>
            ) : (
              <span className="badge viewer">View only</span>
            )}
            {!isOwner && <span className="muted small">Owned by {meta.owner.name}</span>}
          </div>
        </div>
        <div className="doc-actions">
          <details className="menu">
            <summary className="btn small">Export</summary>
            <div className="menu-items">
              <a href="#" onClick={(e) => exportAs(e, 'md')}>Markdown (.md)</a>
              <a href="#" onClick={(e) => exportAs(e, 'html')}>HTML (.html)</a>
            </div>
          </details>
          {isOwner && <button className="btn primary small" onClick={() => setSharing(true)}>Share</button>}
        </div>
      </TopBar>

      {save.conflict && (
        <div className="banner warn" role="alert">
          Someone else saved a newer version of this document while you were editing.
          <button className="btn small" onClick={() => resolve(false)}>Load their version</button>
          <button className="btn small" onClick={() => resolve(true)}>Overwrite with mine</button>
        </div>
      )}
      {!canEdit && (
        <div className="banner info">You have view-only access. Ask {meta.owner.name} for edit access.</div>
      )}

      {editor && <Toolbar editor={editor} disabled={!canEdit} />}
      <main className="page-wrap" onClick={(e) => { if (e.target === e.currentTarget) editor?.commands.focus('end'); }}>
        <article className="page">
          <EditorContent editor={editor} />
        </article>
      </main>

      {sharing && <ShareDialog doc={meta} onClose={() => setSharing(false)} />}
    </>
  );
}
