# Architecture note

## Shape of the system

```
Browser (React + TipTap)  ──fetch /api, httpOnly cookie──▶  Express  ──▶  SQLite (built-in node:sqlite)
        ▲                                                       │
        └────────── static build served by the same process ◀──┘
```

One Node process serves the API and the built SPA. That means one deployable unit, no CORS, and same-site cookies, which is the simplest thing that works on a free Render instance.

**Data model**

- `users(id, email, name, password_hash)`
- `documents(id, owner_id, title, content, version, created_at, updated_at)`
- `document_shares(document_id, user_id, role ∈ {viewer, editor})`, with primary key `(document_id, user_id)` and cascading deletes

Ownership is a column, not a share row. A user's role on a document comes from a single query (owner, else share role, else no access). `documents.js` is the only place that query and the role ranking live, and every route goes through `requireAccess(doc, user, neededRole)`.

## What I prioritized, and why

1. **A trustworthy editing loop.** A doc editor that loses work is worse than one with fewer features, so most of the depth went here:
   - TipTap/ProseMirror instead of `contenteditable` + `execCommand`, so formatting is structured and the toolbar shows active state.
   - Autosave with an 800 ms debounce, one request in flight at a time, and edits made during a save queued and flushed afterwards. Pending work is flushed when you leave the page, and the browser warns before you close a tab with unsaved changes.
   - **Optimistic concurrency.** Each save sends the `version` it was based on, and the `UPDATE … WHERE version = ?` either applies or returns a 409. This matters because sharing with editors makes concurrent edits possible. Without it, the last save silently wins. With it, the user sees a conflict banner and chooses which version to keep.
   - Clear save states: Saved / Unsaved / Saving / Save failed (with retry) / Conflict.
2. **Access control that is correct rather than broad.** Two roles (viewer, editor) plus the owner, enforced on the server. A missing share returns 404, not 403, so the API doesn't reveal which document IDs exist. Only owners can share, change roles, revoke or delete. The UI mirrors these rules (read-only editor, no Share button for non-owners), but the server is the source of truth, and the tests check it.
3. **Safe persistence of rich text.** Content is stored as HTML, because that is TipTap's native round-trip format and it makes import and export easy. It is sanitized on the server against a strict allowlist before every write, so a shared document can't carry a script to another user. A test checks this.
4. **File import that produces something useful.** `.txt`, `.md` and `.docx` each become a new editable document, with headings, emphasis and lists kept (mammoth for Word, marked for Markdown, escaped paragraphs for text). The 2 MB limit and supported types are shown in the UI, and anything else gets a specific error.

## Deliberate tradeoffs and scope cuts

| Decision | Why | Cost / upgrade path |
|---|---|---|
| **No real-time co-editing** | Doing it properly (Yjs/CRDT, websockets, presence) would eat most of the timebox. Version-checked saves give *safety* for concurrent editors, though not live merging. | Next step: Yjs + `y-prosemirror` over a websocket, persisting Yjs updates. |
| **SQLite via built-in `node:sqlite`** | Zero setup for reviewers, synchronous and fast, real SQL constraints (FKs, CHECK, cascades). Using the built-in module instead of `better-sqlite3` means `npm install` never has to compile native code. The cost is requiring Node ≥ 22.13 and an API still marked experimental (its warning is silenced in the npm scripts). | Render free tier has an ephemeral disk, so data resets on restart (the demo re-seeds itself). The schema is plain SQL, so moving to Postgres means swapping the driver. |
| **Seeded users + email/password login, stateless HMAC cookie** | Makes the sharing demo concrete without building sign-up or reset flows. Passwords are hashed with scrypt, the cookie is httpOnly + SameSite=Lax (+ Secure in production), and signatures are compared in constant time. | No sign-up, no session revocation list, no rate limiting on login. |
| **Store HTML, not ProseMirror JSON** | Simpler import/export and easy to inspect in the DB. Sanitizing on the server keeps it safe. | JSON would be more future-proof for CRDTs and schema migrations. |
| **Upload creates a new document** (no attachments) | This was the most product-relevant option: it is how people actually move existing notes into a new tool. It also avoids blob storage. | Import into an existing doc, and attachments via object storage. |
| **Export to Markdown/HTML** (stretch) | Cheap (turndown), and it completes the import/export story. | PDF export. |

## Validation and error handling

- Inputs: title is non-empty and at most 200 characters; content must be a string under 500 KB; JSON body is capped at 1 MB; role is limited to the two allowed values; email must belong to a known user; you can't share with yourself.
- Errors are JSON `{ error }` with the right status code (400/401/403/404/409/413/415). 5xx errors are logged on the server and shown to the client as a generic message.
- The client shows these messages inline (login, dashboard, share dialog) and recovers from failed saves without dropping edits.

## Testing strategy

- **API tests (Vitest + Supertest, in-memory SQLite):** these cover the rules that would be costly to get wrong, namely the access-control matrix, conflict detection, sanitization, import, and validation.
- **Browser smoke test (Playwright, `scripts/e2e-smoke.cjs`):** runs the real UI through creating, formatting, refreshing, sharing, the viewer experience, import, conflict, export and mobile layout. I used it to verify the build and to produce the screenshots.

## What I'd build next (2–4 more hours)

1. Real-time co-editing and presence with Yjs (the main gap compared with Google Docs).
2. Version history: snapshot on each save, with a list and restore. The `version` column is already the hook for this.
3. Durable hosted storage (Postgres or a persistent disk) and login rate limiting.
4. Import into the current document, and paste-image support.
5. Code-split the editor bundle (currently about 680 KB minified) and add component tests for the autosave hook.
