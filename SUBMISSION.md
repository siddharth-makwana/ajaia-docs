# Submission — Ajaia Docs

| Item | Location |
|---|---|
| Live product URL | _<Render URL>_ (free tier: the first load after idling takes about 30 s) |
| Walkthrough video | `VIDEO_URL.txt` |
| Source code | `server/`, `client/`, `tests/`, `scripts/` |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Screenshots | `docs/screenshots/` (login, dashboard, editor, share dialog, shared-with-me, viewer, conflict, mobile) |
| Deployment config | `render.yaml` |
| Automated tests | `tests/api.test.js` (12 tests, `npm test`); `scripts/e2e-smoke.cjs` (optional Playwright flow) |

## Test accounts

Password for all: **`password123`**

- `alice@ajaia.dev`: owns the Welcome doc (shared with Bob as editor)
- `bob@ajaia.dev`: editor on the Welcome doc; owns a private note
- `carol@ajaia.dev`: nothing shared yet; use her to test view-only sharing

## Status

**Working:** create, rename, edit with rich text (headings, bold/italic/underline/strike, bulleted and numbered lists, quote), autosave and reopen. Also `.txt`/`.md`/`.docx` import, owner→user sharing with view/edit roles, the owned vs shared split, server-enforced access control, conflict-safe saves, Markdown/HTML export, and a responsive layout.

**Not built (by choice):** real-time co-editing, comments, version history, sign-up and password reset, importing into an existing document.

**Known limitation:** on Render's free tier the SQLite file is ephemeral, so data resets on restart or redeploy and the demo data re-seeds automatically.

**Next 2–4 hours:** Yjs real-time collaboration and presence, then version history built on the existing `version` column, durable Postgres storage, and login rate limiting.
