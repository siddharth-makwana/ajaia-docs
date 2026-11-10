# Walkthrough talk track (≈4 min)

1. **(0:00) Framing, 20 s.** "A focused slice of Google Docs. I put most of the depth into a trustworthy editing loop and correct sharing rules, rather than spreading effort across many features."
2. **(0:20) Create & edit, 60 s.** Sign in as Alice → Blank document → rename → H1, bold/italic/underline, bullets, numbered list. Point at the save status. Refresh to show everything persisted.
3. **(1:20) Import, 30 s.** Dashboard → Import a file → .docx or .md, and it opens as an editable doc. Mention the supported types and the 2 MB limit, and show the error for a PDF.
4. **(1:50) Sharing, 60 s.** Share with Carol as **Can view**. Sign in as Carol → *Shared with me* tab with owner and "View only" badge → read-only editor. Mention the server-side checks and the 404-not-403 choice.
5. **(2:50) Conflict safety, 30 s.** Alice and Bob in two windows → Bob gets the conflict banner. "Last-write-wins would have silently lost work."
6. **(3:20) Tradeoffs, 30 s.** No real-time CRDT, SQLite on an ephemeral free tier, seeded auth. Next steps: Yjs, version history.
7. **(3:50) AI, 30 s.** What it sped up (boilerplate, library glue, tests), what I changed (404 semantics, concurrency, sanitization, mobile CSS), and how I verified it (API tests, Playwright pass, reviewing the screenshots).
