# AI workflow note

> ✏️ Candidate: check this against your own experience and edit it before you submit. It should describe how *you* worked.

## Tools used

- **Claude (Anthropic) in an agentic coding environment.** I used it to scaffold the server and client, write tests, run the app, and drive a headless browser to check the UI.
- **Playwright** (scripted by the AI and reviewed by me) to check each flow end to end and capture screenshots.

## Where AI materially sped things up

- **Boilerplate and wiring:** the Express routes, the SQLite schema, the multer upload pipeline, the React pages, and the CSS. That's the kind of code that is easy to describe and slow to type.
- **Library glue:** getting mammoth (.docx), marked (.md), sanitize-html and turndown to agree on one HTML subset that the editor produces and accepts.
- **Tests:** turning the access-control rules I specified (no access → 404, viewer → 403 on write, editor can write, revoke removes access) into a Supertest suite, plus a full Playwright flow.

## What I changed or rejected

- **Native SQLite driver.** The AI's first choice was `better-sqlite3`. A clean `npm ci` from the zipped submission then failed because the package fell back to compiling with node-gyp, which needs a C++ toolchain and network access to download Node headers. Reviewers on a fresh laptop could hit the same failure, so I switched to Node's built-in `node:sqlite` (about 20 lines changed, including a small transaction helper) and re-verified the clean install.
- **Duplicate Underline extension.** The first draft added `@tiptap/extension-underline`, but TipTap v3's StarterKit already includes Underline (and Link). Registering it twice causes a duplicate-extension warning, so I removed the extra package.
- **403 vs 404 for documents you can't access.** The initial approach returned 403 when a user had no share. I changed it to 404 so the API doesn't confirm that a document ID exists. 403 is kept for "you can see this but can't do that" (viewer edits, non-owner sharing).
- **Last-write-wins saves.** The first draft of autosave just PATCHed the latest HTML. Once sharing with editors existed, that meant silent data loss, so I added the `version` column, the `WHERE version = ?` guard, the 409 response and the conflict banner. I treat this as a product decision, not a code detail.
- **Server-side sanitization.** I required content to be sanitized on write rather than trusting the editor, since another user's browser renders it. There is a test for `<script>`, inline handlers and `<img onerror>`.
- **Mobile header.** The AI-written CSS looked right on desktop, but the screenshot at 390 px showed the title, Share button and avatar overlapping. I rewrote the small-screen layout so the doc controls wrap onto their own row.
- **Copy.** The seeded welcome doc pointed to "H1/H2/H3 buttons", but the final UI uses a text-style dropdown. I fixed the copy to match the UI.
- **Flaky check.** One end-to-end assertion used `isVisible()` (which doesn't wait) right after navigation and failed intermittently. I replaced it with an explicit `waitFor()`.

## How I verified correctness, UX and reliability

- I did a clean-room check: unzip the submission into an empty folder, `npm ci`, `npm test`, `npm run build`. This is what caught the native-module problem above.
- `npm test` runs 12 API tests that cover the rules most likely to break.
- I ran a scripted Playwright pass against the production build, covering each requirement: create → rename → format → reload (asserting the exact HTML that persisted), sharing with an unknown email (error shown), viewer experience (contenteditable=false, no Share button), unshared user (not-found page), `.md` import, rejected `.pdf` upload, a two-user conflict, Markdown export, and a horizontal-scroll check at mobile width. I also checked for unexpected console errors.
- I reviewed the screenshots myself (`docs/screenshots/`) for layout, hierarchy and empty/error states, rather than trusting that code which compiles looks right.
- I read through the access-control query and the autosave state machine by hand. Those are the two places where a plausible-looking bug would cause real harm.
