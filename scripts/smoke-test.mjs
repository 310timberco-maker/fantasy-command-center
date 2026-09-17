// One-off manual QA script (not part of the app bundle, not a devDependency
// of package.json on purpose - `npm install` stays lightweight for a
// reviewer who just wants to run the app). Drives a headless browser
// through onboarding and the five main screens, logging console errors and
// confirming each expected route actually rendered content.
//
// To rerun: npm install -D playwright && npm run build && npm run preview -- --port 4173
// then in another terminal: node scripts/smoke-test.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
page.on('response', (res) => { if (res.status() >= 400) console.log('RESP', res.status(), res.url()); });

async function goto(hash, label) {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  const bodyText = await page.textContent('#app');
  const ok = bodyText && bodyText.trim().length > 20;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${hash.padEnd(38)} ${label}`);
  if (!ok) errors.push(`Empty render at ${hash}`);
  return page;
}

async function click(selector, label) {
  await page.click(selector);
  await page.waitForTimeout(200);
  console.log(`click -> ${label} => now at ${page.url()}`);
}

// --- Full onboarding path, following the actual buttons a user would press ---
await goto('/', 'Welcome');
await click('#btn-get-started', 'Get Started');
await goto('/onboarding/account', 'Create Account (direct nav check)');

// re-drive via real click from welcome to be sure onclick handler works end-to-end
await goto('/', 'Welcome (again)');
await page.click('#btn-get-started');
await page.waitForTimeout(150);
console.log('after Get Started click, url =', page.url());

await page.click("form#signup-form button[type=submit]");
await page.waitForTimeout(150);
console.log('after account submit, url =', page.url());

await goto('/onboarding/leagues/add', 'Add First League');
await page.click('#continue-detected-btn');
await page.waitForTimeout(150);
console.log('after continue-detected-btn, url =', page.url());

await goto('/onboarding/leagues/scoring/review', 'Review Detected Scoring');
await page.click("button:has-text('SCORING LOOKS RIGHT')");
await page.waitForTimeout(150);
console.log('after scoring-looks-right, url =', page.url());

await goto('/onboarding/lineup/scan', 'Scan My Lineup');
await goto('/onboarding/lineup/confirm', 'Confirm My Lineup');
await page.click('#confirm-roster-btn');
await page.waitForTimeout(150);
console.log('after confirm-roster-btn, url =', page.url());

await goto('/onboarding/lineup/opponent', 'Confirm Opponent Lineup');
await page.click('#confirm-opponent-btn');
await page.waitForTimeout(700);
console.log('after confirm-opponent-btn, url =', page.url());

await goto('/onboarding/leagues/status', 'Leagues Status');
await goto('/onboarding/leagues/bulk-add', 'Bulk Add Leagues');
await goto('/onboarding/alerts', 'Contextual Alerts');
await page.click('#enable-alerts-btn');
await page.waitForTimeout(1200);
console.log('after enable-alerts-btn, url =', page.url());

await goto('/onboarding/ready', 'Payoff Ready');
await page.click('#view-sunday-btn');
await page.waitForTimeout(200);
console.log('after view-sunday-btn, url =', page.url());

// --- The five primary app screens + leagues hub, via the shared shell nav ---
for (const [hash, label] of [
  ['/app/watch', 'Watch Now'],
  ['/app/itinerary', 'Sunday Command Center Itinerary'],
  ['/app/matchups', 'Live Fantasy Matchups'],
  ['/app/players', 'Players Exposure Leaderboard'],
  ['/app/activity', 'Live Activity Feed'],
  ['/app/leagues', 'Leagues Hub'],
  ['/app/leagues/weekly-setup', 'Weekly Setup'],
]) {
  await goto(hash, label);
}

// click through the shared shell nav itself (not just direct hash nav)
await goto('/app/watch', 'Watch Now (nav test start)');
await click('nav a[data-path="/app/itinerary"]', 'shell nav -> Itinerary');
await click('nav a[data-path="/app/matchups"]', 'shell nav -> Matchups');
await click('nav a[data-path="/app/players"]', 'shell nav -> Players');
await click('nav a[data-path="/app/activity"]', 'shell nav -> Activity');
await click('nav a[data-path="/app/leagues"]', 'shell nav -> Leagues');

await browser.close();

console.log('\n--- SUMMARY ---');
if (errors.length) {
  console.log(`${errors.length} problem(s) found:`);
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
} else {
  console.log('No console errors, no empty renders. All routes navigable.');
}
