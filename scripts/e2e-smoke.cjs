// End-to-end smoke test of the full user flow (requires `npm i -D playwright && npx playwright install chromium`).
// Run against a FRESH database:  npm run build && npm start  (in one shell), then  node scripts/e2e-smoke.cjs
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const path = require('path');
const SHOTS = path.join(__dirname, '..', 'docs', 'screenshots');
const errors = []; const expected = /401|404|409|415/;
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg); };

async function newUser(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && !expected.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(BASE);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByText('Owned by me').waitFor();
  return page;
}
const waitSaved = (p) => p.locator('.save-status.saved').waitFor({ timeout: 5000 });

(async () => {
  const browser = await chromium.launch();
  // Login page
  const lp = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await lp.goto(BASE); await lp.screenshot({ path: `${SHOTS}/01-login.png` });

  const alice = await newUser(browser, 'Alice Chen');
  check(await alice.getByText('Welcome to Ajaia Docs').isVisible(), 'Alice sees owned Welcome doc');
  await alice.screenshot({ path: `${SHOTS}/02-dashboard.png` });

  // Create + rename + format
  await alice.getByRole('button', { name: /Blank document/ }).click();
  await alice.locator('.tiptap').waitFor();
  const title = alice.getByLabel('Document title');
  await title.fill('Q3 Launch Plan'); await title.press('Enter');
  await waitSaved(alice);
  await alice.getByLabel('Text style').selectOption('h1');
  await alice.keyboard.type('Launch goals');
  await alice.keyboard.press('Enter');
  await alice.keyboard.type('We will ');
  await alice.getByRole('button', { name: 'Bold (Ctrl+B)' }).click();
  await alice.keyboard.type('ship on time');
  await alice.getByRole('button', { name: 'Bold (Ctrl+B)' }).click();
  await alice.keyboard.type(' and ');
  await alice.keyboard.press('Control+i'); await alice.keyboard.type('stay focused'); await alice.keyboard.press('Control+i');
  await alice.keyboard.type(' with ');
  await alice.keyboard.press('Control+u'); await alice.keyboard.type('clear owners'); await alice.keyboard.press('Control+u');
  await alice.keyboard.press('Enter');
  await alice.getByRole('button', { name: 'Bulleted list' }).click();
  await alice.keyboard.type('Editor'); await alice.keyboard.press('Enter'); await alice.keyboard.type('Sharing');
  await alice.keyboard.press('Enter'); await alice.keyboard.press('Enter');
  await alice.getByRole('button', { name: 'Numbered list' }).click();
  await alice.keyboard.type('Design review'); await alice.keyboard.press('Enter'); await alice.keyboard.type('Ship it');
  await waitSaved(alice);
  const url = alice.url();
  await alice.reload(); await alice.locator('.tiptap h1').waitFor();
  const html = await alice.locator('.tiptap').innerHTML();
  check(await title.inputValue() === 'Q3 Launch Plan', 'rename persisted after reload');
  for (const t of ['<h1>Launch goals', '<strong>ship on time</strong>', '<em>stay focused</em>', '<u>clear owners</u>', '<ul>', '<ol>'])
    check(html.includes(t), `formatting persisted: ${t}`);
  await alice.screenshot({ path: `${SHOTS}/03-editor.png` });

  // Share with Carol as viewer
  await alice.getByRole('button', { name: 'Share' }).click();
  await alice.getByPlaceholder('Add people by email').fill('carol@ajaia.dev');
  await alice.getByLabel('Access level').selectOption('viewer');
  await alice.getByRole('button', { name: 'Share', exact: true }).last().click();
  await alice.getByText('Carol Diaz').waitFor();
  await alice.getByPlaceholder('Add people by email').fill('nobody@nowhere.dev');
  await alice.getByRole('button', { name: 'Share', exact: true }).last().click();
  await alice.getByRole('alert').waitFor();
  check((await alice.getByRole('alert').textContent()).includes('No user'), 'unknown email error shown');
  await alice.getByPlaceholder('Add people by email').fill('');
  await alice.screenshot({ path: `${SHOTS}/04-share-dialog.png` });
  await alice.getByRole('button', { name: 'Done' }).click();

  // Import file
  await alice.goto(BASE);
  await alice.locator('input[type=file]').setInputFiles({ name: 'sprint-notes.md', mimeType: 'text/markdown', buffer: Buffer.from('# Sprint notes\n\nWe **shipped** the editor.\n\n- Sharing\n- Export\n') });
  await alice.locator('.tiptap h1').waitFor();
  check(await alice.getByLabel('Document title').inputValue() === 'sprint-notes', 'imported md becomes doc');
  check((await alice.locator('.tiptap').innerHTML()).includes('<strong>shipped</strong>'), 'imported formatting kept');
  await alice.goto(BASE);
  await alice.locator('input[type=file]').setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
  await alice.getByRole('alert').waitFor();
  check((await alice.getByRole('alert').textContent()).includes('Supported'), 'unsupported upload error shown');

  // Carol: shared tab, view only
  const carol = await newUser(browser, 'Carol Diaz');
  await carol.getByRole('tab', { name: /Shared with me/ }).click();
  check(await carol.getByText('Q3 Launch Plan').isVisible(), 'Carol sees doc under Shared with me');
  check(await carol.getByText('View only').isVisible(), 'role badge visible');
  await carol.screenshot({ path: `${SHOTS}/05-shared-with-me.png` });
  await carol.getByText('Q3 Launch Plan').click();
  await carol.locator('.tiptap').waitFor();
  check(await carol.locator('.tiptap').getAttribute('contenteditable') === 'false', 'viewer cannot edit');
  check(!(await carol.getByRole('button', { name: 'Share' }).count()), 'viewer has no Share button');
  await carol.screenshot({ path: `${SHOTS}/06-viewer.png` });
  const bob0 = await newUser(browser, 'Bob Patel');
  await bob0.goto(url);
  await bob0.getByText('Document not found').waitFor(); check(true, 'unshared user gets not found');

  // Conflict: Alice and Bob both edit the Welcome doc (Bob is editor)
  await alice.goto(BASE); await alice.getByText('Welcome to Ajaia Docs').click(); await alice.locator('.tiptap').waitFor();
  const bob = bob0; await bob.goto(BASE); await bob.getByRole('tab', { name: /Shared/ }).click();
  await bob.getByText('Welcome to Ajaia Docs').click(); await bob.locator('.tiptap').waitFor();
  await alice.locator('.tiptap p').first().click(); await alice.keyboard.press('End'); await alice.keyboard.type(' Alice was here.');
  await waitSaved(alice);
  await bob.locator('.tiptap p').first().click(); await bob.keyboard.press('End'); await bob.keyboard.type(' Bob too.');
  await bob.locator('.banner.warn').waitFor({ timeout: 5000 });
  check(true, 'stale save surfaces conflict banner');
  await bob.screenshot({ path: `${SHOTS}/07-conflict.png` });
  await bob.getByRole('button', { name: 'Overwrite with mine' }).click();
  await waitSaved(bob);
  check((await bob.locator('.tiptap').innerHTML()).includes('Bob too.'), 'overwrite saves Bob version');

  // Export
  const [dl] = await Promise.all([alice.waitForEvent('download'), (async () => { await alice.reload(); await alice.locator('.tiptap').waitFor(); await alice.getByText('Export').click(); await alice.getByText('Markdown (.md)').click(); })()]);
  const md = require('fs').readFileSync(await dl.path(), 'utf8');
  check(md.startsWith('# Welcome to Ajaia Docs') && md.includes('Bob too.'), 'markdown export works');

  // Mobile
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await m.goto(BASE); await m.getByRole('button', { name: /Alice/ }).click(); await m.getByText('Owned by me').waitFor();
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= 390, `no horizontal scroll on mobile (${sw})`);
  await m.getByText('Q3 Launch Plan').click(); await m.locator('.tiptap h1').waitFor();
  await m.screenshot({ path: `${SHOTS}/08-mobile.png` });

  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error(e); console.log('console errors:', errors); process.exit(1); });
