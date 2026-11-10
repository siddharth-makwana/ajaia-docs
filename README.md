# Ajaia Docs

A lightweight collaborative document editor: create and format documents in the browser, import files, and share them with teammates as editors or viewers.

**Live demo:** _<add Render URL here>_ · **Walkthrough video:** see `VIDEO_URL.txt`

## Demo accounts

All accounts use the password **`password123`**. The login page also has one-click buttons for each.

| User | Email | What to try |
|---|---|---|
| Alice Chen | `alice@ajaia.dev` | Owns "Welcome to Ajaia Docs", which is shared with Bob as an editor |
| Bob Patel | `bob@ajaia.dev` | Sees the Welcome doc under **Shared with me** and can edit it; owns a private note |
| Carol Diaz | `carol@ajaia.dev` | Starts with nothing shared. Share something with her as a viewer to see read-only mode |

**Suggested 2-minute review path**

1. Sign in as Alice and click **Blank document**. Rename it, type, and use the toolbar (headings, bold, italic, underline, lists). Watch the status go from "Saving…" to "Saved", then refresh the page.
2. Click **Share**, add `carol@ajaia.dev` as **Can view**, then sign out.
3. Sign in as Carol and open **Shared with me**. The doc shows the owner and a "View only" badge, and the editor is read-only.
4. Back on the dashboard, use **Import a file** with a `.md`, `.txt` or `.docx` file. It opens as a new editable document.
5. Optional: to see conflict handling, open the Welcome doc as Alice in one browser and as Bob in a private window. Edit as Alice, then edit as Bob, and Bob gets a conflict banner.

## Features

| Area | What's there |
|---|---|
| Documents | Create, rename (click the title), edit, autosave (800 ms idle), reopen, delete (owner only) |
| Formatting | Normal text / H1 / H2 / H3, bold, italic, underline, strikethrough, bulleted and numbered lists, quote, divider, clear formatting, undo/redo, standard keyboard shortcuts |
| File import | `.txt`, `.md`, `.docx` up to **2 MB**, each turned into a new editable document. Other file types get a clear 415 error. The limits are shown in the UI. |
| Sharing | Owner shares by email with the **Can edit** or **Can view** role, can change roles and remove access. The dashboard splits **Owned by me** from **Shared with me**. |
| Access control | Enforced on the server for every route. Users without access get a 404, so the API never confirms that a document exists. Viewers get a 403 if they try to write. |
| Persistence | SQLite (documents, shares, users). Content is stored as sanitized HTML, so formatting round-trips exactly. |
| Concurrency safety | Every save carries a `version`. A stale save returns a 409, and the user picks "Load their version" or "Overwrite with mine" instead of silently losing work. |
| Export (stretch) | Download as Markdown or HTML |

## Run locally

Requires **Node 22.13 or newer** (see `.nvmrc`). The app uses Node's built-in `node:sqlite`, so there are no native modules to compile and no database to install.

```bash
npm install
npm run dev        # API on :3001 and Vite on :5173 → open http://localhost:5173
```

The SQLite database is created at `data/ajaia.db` and seeded with the demo accounts the first time the app starts. To reset it, delete the `data/` folder.

Production-style run (one process that serves the API and the built frontend):

```bash
npm run build
npm start          # → http://localhost:3001
```

### Tests

```bash
npm test           # Vitest + Supertest: 12 API tests on an in-memory DB
```

They cover auth (including a forged cookie), create/rename/edit/reopen with formatting preserved, XSS sanitization, validation, 409 conflict detection, the full sharing/role matrix (no access → viewer → editor → revoked), and `.md`/`.txt`/`.docx` import plus rejection of unsupported types.

There is also an optional browser smoke test of the whole user flow, which regenerates `docs/screenshots/`. It needs Playwright and a fresh database:

```bash
npm i -D playwright && npx playwright install chromium
rm -rf data && npm run build && npm start &   # fresh DB
npm run test:e2e
```

### Environment variables

| Name | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `DATABASE_PATH` | `./data/ajaia.db` | SQLite file location |
| `SESSION_SECRET` | dev value; random in production | HMAC key for session cookies |

## Deploy (Render)

`render.yaml` is a Render Blueprint. In Render, choose **New → Blueprint**, point it at this repo, and click **Apply**. It builds with `npm ci --include=dev && npm run build`, starts with `npm start`, health-checks `/api/health`, and generates `SESSION_SECRET` for you.

> **Free-tier note:** Render's free web services have an ephemeral filesystem, so the SQLite file resets whenever the service restarts or redeploys (including waking up after about 15 minutes idle). The demo data is re-seeded automatically, so reviewers always get a working environment, but documents you create won't survive a restart. For durable storage, attach a Render Disk (paid) and set `DATABASE_PATH=/var/data/ajaia.db`, or move to managed Postgres (see `ARCHITECTURE.md`). The first request after idling takes about 30 seconds while the instance wakes up.

## Project layout

```
server/            Express API
  app.js           routes, upload handling, error middleware
  documents.js     document + sharing service (all access rules live here)
  auth.js          password hashing, signed session cookie
  importers.js     .txt/.md/.docx → sanitized HTML
  sanitize.js      HTML allowlist
  db.js / seed.js  schema + demo data
client/src/        React app (Vite)
  pages/           Login, Dashboard, EditorPage (autosave + conflict handling)
  components/      Toolbar, ShareDialog, TopBar
tests/             API tests + .docx fixture
scripts/           Playwright end-to-end smoke test
docs/screenshots/  UI screenshots
```

## Status

**Working end to end:** everything in the feature table above, on desktop and mobile widths.

**Intentionally not built:** real-time co-editing, comments/suggestions, version history, password reset/sign-up, and importing into an existing document. See `ARCHITECTURE.md` for the reasons and what I'd build next.
