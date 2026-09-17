// Converts the static Stitch export in screens/*.html into small JS modules
// under src/screens/*.js that the app's vanilla-JS router can mount.
//
// Why a generator instead of hand-porting: the exported HTML is already the
// approved visual source of truth (Tailwind classes + inline styles + a
// couple of small inline <script> blocks). Re-typing ~20 large files by hand
// is exactly the kind of transcription that introduces visual drift. Instead
// we mechanically extract the <body> content, strip the chrome each screen
// shares with its group (top header stays inline per-screen since copy
// differs; the bottom tab bar is identical within a group so the shared
// shell renders it once), fix asset paths, and replace the Stitch
// "{{DATA:SCREEN:SCREEN_NN}}" placeholders with real in-app routes.
//
// Re-run with `npm run generate:screens` any time screens/*.html changes.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCREENS_SRC = path.join(ROOT, 'screens');
const OUT_DIR = path.join(ROOT, 'src', 'screens');

// The Stitch export used numbered screen placeholders consistently across
// every file (SCREEN_24 always meant "go to Watch Now", etc). This is the
// single global mapping from those ids to the routes we actually built.
const SCREEN_ROUTE_MAP = {
  2: '/onboarding/leagues/bulk-add',
  4: '/app/leagues',
  8: '/onboarding/alerts',
  10: '/onboarding/leagues/status',
  11: '/onboarding/lineup/opponent',
  13: '/onboarding/lineup/scan',
  14: '/onboarding/lineup/confirm',
  15: '/onboarding/leagues/scoring/review',
  16: '/onboarding/leagues/scoring',
  17: '/onboarding/leagues/add',
  18: '/onboarding/account',
  19: '/',
  20: '/app/activity',
  21: '/app/players',
  22: '/app/watch',
  23: '/app/matchups',
  24: '/app/watch',
};

// Which screens exist, where their source lives, what route they mount at,
// and whether their bottom <nav> tab bar should be stripped in favor of the
// shared AppShell nav (every /app/* route shares one shell + nav; onboarding
// routes are standalone pages and keep whatever chrome Stitch gave them).
const SCREEN_CONFIGS = [
  { file: 'onboarding-welcome.html', out: 'welcome.js', route: '/', stripNav: false },
  { file: 'onboarding-create-account.html', out: 'createAccount.js', route: '/onboarding/account', stripNav: false },
  { file: 'setup-add-first-league.html', out: 'addFirstLeague.js', route: '/onboarding/leagues/add', stripNav: false },
  { file: 'setup-scoring-rules-upload.html', out: 'scoringRulesUpload.js', route: '/onboarding/leagues/scoring', stripNav: false },
  { file: 'setup-review-detected-scoring.html', out: 'reviewDetectedScoring.js', route: '/onboarding/leagues/scoring/review', stripNav: false },
  { file: 'setup-add-scan-my-lineup.html', out: 'scanMyLineup.js', route: '/onboarding/lineup/scan', stripNav: false },
  { file: 'setup-confirm-my-lineup.html', out: 'confirmMyLineup.js', route: '/onboarding/lineup/confirm', stripNav: false },
  { file: 'setup-confirm-opponent-lineup.html', out: 'confirmOpponentLineup.js', route: '/onboarding/lineup/opponent', stripNav: false },
  { file: 'setup-add-your-leagues-bulk-ingestion.html', out: 'bulkAddLeagues.js', route: '/onboarding/leagues/bulk-add', stripNav: false },
  { file: 'setup-contextual-live-alerts.html', out: 'contextualAlerts.js', route: '/onboarding/alerts', stripNav: false },
  { file: 'payoff-ready-for-sunday.html', out: 'payoffReady.js', route: '/onboarding/ready', stripNav: false },

  { file: 'watch-now-live-broadcast-experience.html', out: 'watchNow.js', route: '/app/watch', stripNav: true },
  { file: 'sunday-command-center-itinerary.html', out: 'itinerary.js', route: '/app/itinerary', stripNav: true },
  { file: 'live-fantasy-matchups-scoreboard.html', out: 'matchups.js', route: '/app/matchups', stripNav: true },
  { file: 'players-exposure-leaderboard.html', out: 'players.js', route: '/app/players', stripNav: true },
  { file: 'live-activity-feed-real-time-stream.html', out: 'activity.js', route: '/app/activity', stripNav: true },
  { file: 'setup-multi-league-portfolio-status.html', out: 'leaguesHub.js', route: '/app/leagues', stripNav: true },
  { file: 'weekly-setup-quick-sync-bulk-drop.html', out: 'weeklySetup.js', route: '/app/leagues/weekly-setup', stripNav: true },
];

function extractBody(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error('No <body> found');
  return bodyMatch[1];
}

function extractAndStripScripts(html) {
  const scripts = [];
  const stripped = html.replace(/<script(?![^>]*id="tailwind-config")[^>]*>([\s\S]*?)<\/script>/gi, (_, inner) => {
    if (inner.trim()) scripts.push(inner);
    return '';
  });
  return { stripped, scripts };
}

function stripBottomNav(html) {
  return html.replace(/<nav[\s\S]*<\/nav>\s*$/i, '');
}

function fixAssetPaths(html) {
  return html.replaceAll('../assets/images/', '/assets/images/');
}

function replaceScreenPlaceholders(html) {
  // Plain hrefs: href="{{DATA:SCREEN:SCREEN_24}}"
  html = html.replace(/\{\{DATA:SCREEN:SCREEN_(\d+)\}\}/g, (full, num) => {
    const route = SCREEN_ROUTE_MAP[Number(num)];
    return route ? `#${route}` : full;
  });
  // Disabled placeholders Stitch left as onclick="location.href='#'; /* {{DATA:SCREEN:SCREEN_18}} */"
  html = html.replace(/location\.href='#';\s*\/\*\s*#([^\s*]+)\s*\*\//g, "location.hash='$1';");
  return html;
}

// A handful of screens shipped with a button that Stitch left completely
// inert (no href, no onclick, sometimes not even a placeholder comment) even
// though the surrounding flow makes the intended behavior obvious - e.g. a
// "Skip step" button with nothing telling it where to go. Rather than
// inventing new screens or redesigning anything, these patches wire that
// last mile: literal substring replacements applied to one specific
// generated file each, so a screen with no listed patch is untouched.
const POST_PATCHES = {
  'addFirstLeague.js': {
    replacements: [
      // Give the uncertain-item row and its review button real ids so a
      // click can surface exactly the one thing detection wasn't sure about
      // (the onboarding philosophy: only ask about what's missing/uncertain).
      [
        '<div class="flex items-center justify-between py-1"><div class="flex items-center gap-space-xs"><span class="font-body-sm text-body-sm text-on-surface-variant">Opponent:</span><span class="font-body-sm text-body-sm text-on-surface font-semibold">8 of 9 starters detected</span></div><span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary-container/50 text-secondary font-label-sm text-label-sm font-semibold"><span class="material-symbols-outlined text-[12px]">warning</span>NEEDS REVIEW: Kicker uncertain</span></div>',
        '<div class="flex items-center justify-between py-1" id="uncertain-kicker-row"><div class="flex items-center gap-space-xs"><span class="font-body-sm text-body-sm text-on-surface-variant">Opponent:</span><span class="font-body-sm text-body-sm text-on-surface font-semibold">8 of 9 starters detected</span></div><span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary-container/50 text-secondary font-label-sm text-label-sm font-semibold"><span class="material-symbols-outlined text-[12px]">warning</span>NEEDS REVIEW: Kicker uncertain</span></div>',
      ],
      [
        '<button class="w-full h-11 bg-surface-container-high hover:bg-surface-bright text-secondary border border-secondary/30 font-headline-sm text-headline-sm font-semibold uppercase rounded-lg transition-colors flex items-center justify-center gap-space-xs active:scale-[0.99]" type="button">',
        '<button id="review-uncertain-btn" class="w-full h-11 bg-surface-container-high hover:bg-surface-bright text-secondary border border-secondary/30 font-headline-sm text-headline-sm font-semibold uppercase rounded-lg transition-colors flex items-center justify-center gap-space-xs active:scale-[0.99]" type="button">',
      ],
    ],
    appendScript: `
document.getElementById('review-uncertain-btn')?.addEventListener('click', function handler() {
  const row = document.getElementById('uncertain-kicker-row');
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.add('ring-2', 'ring-secondary', 'rounded');
  this.innerHTML = '<span class="material-symbols-outlined text-[18px] text-primary">check_circle</span><span>KICKER CONFIRMED (LOOKS RIGHT)</span>';
  this.classList.add('text-primary', 'border-primary/30');
  this.classList.remove('text-secondary', 'border-secondary/30');
  this.removeEventListener('click', handler);
  setTimeout(() => row.classList.remove('ring-2', 'ring-secondary'), 2000);
});`,
  },
  // "Skip step" in these five screens had no destination at all in the
  // Stitch export (no href, no onclick, no placeholder comment) - each
  // lives mid-flow where the obvious behavior is "move on without
  // finishing this step's detail work", i.e. the same destination as that
  // screen's own primary continue action.
  'confirmMyLineup.js': { skipTo: '/onboarding/lineup/opponent' },
  'reviewDetectedScoring.js': { skipTo: '/onboarding/lineup/scan' },
  'scanMyLineup.js': { skipTo: '/onboarding/lineup/confirm' },
  'scoringRulesUpload.js': { skipTo: '/onboarding/leagues/scoring/review' },
  'contextualAlerts.js': { skipTo: '/onboarding/ready' },
};

function applyPostPatches(outName, body, scriptText) {
  const patch = POST_PATCHES[outName];
  if (!patch) return { body, scriptText };

  let nextBody = body;
  for (const [find, replace] of patch.replacements || []) {
    if (!nextBody.includes(find)) {
      throw new Error(`POST_PATCHES[${outName}]: expected substring not found: ${find.slice(0, 80)}...`);
    }
    nextBody = nextBody.replace(find, replace);
  }

  if (patch.skipTo) {
    const skipBtn = '<button aria-label="Skip step" class="h-11 px-space-sm flex items-center justify-center font-label-md text-label-md text-outline hover:text-on-surface tracking-wider uppercase transition-colors" type="button">';
    if (!nextBody.includes(skipBtn)) {
      throw new Error(`POST_PATCHES[${outName}]: Skip step button markup not found`);
    }
    nextBody = nextBody.replace(
      skipBtn,
      `<button aria-label="Skip step" class="h-11 px-space-sm flex items-center justify-center font-label-md text-label-md text-outline hover:text-on-surface tracking-wider uppercase transition-colors" type="button" onclick="location.hash='${patch.skipTo}'">`,
    );
  }

  const nextScript = patch.appendScript ? `${scriptText}\n${patch.appendScript}` : scriptText;
  return { body: nextBody, scriptText: nextScript };
}

function generate() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifestEntries = [];

  for (const cfg of SCREEN_CONFIGS) {
    const srcPath = path.join(SCREENS_SRC, cfg.file);
    const raw = readFileSync(srcPath, 'utf8');
    let body = extractBody(raw);
    const { stripped, scripts } = extractAndStripScripts(body);
    body = stripped;
    if (cfg.stripNav) body = stripBottomNav(body);
    body = fixAssetPaths(body);
    body = replaceScreenPlaceholders(body);
    body = body.trim();

    let scriptText = scripts.join('\n');
    ({ body, scriptText } = applyPostPatches(cfg.out, body, scriptText));

    const moduleSource = `// AUTO-GENERATED by scripts/generate-screens.mjs from screens/${cfg.file}
// Do not hand-edit the markup here directly for structural screen changes -
// re-run \`npm run generate:screens\` instead so it stays in sync with the
// Stitch export. Behavioral wiring lives in src/lib/interactions.js and the
// route's entry in src/lib/routes.js.
export const route = ${JSON.stringify(cfg.route)};
export const sourceFile = ${JSON.stringify(cfg.file)};
export const stripNav = ${cfg.stripNav};
export const html = ${JSON.stringify(body)};
export const inlineScript = ${JSON.stringify(scriptText)};
`;
    writeFileSync(path.join(OUT_DIR, cfg.out), moduleSource, 'utf8');
    manifestEntries.push({ out: cfg.out, route: cfg.route });
    console.log(`generated src/screens/${cfg.out}  (${cfg.route})`);
  }

  const manifestSource = `// AUTO-GENERATED by scripts/generate-screens.mjs
${manifestEntries.map((e, i) => `import * as screen${i} from './${e.out.replace('.js', '')}.js';`).join('\n')}

export const generatedScreens = [
${manifestEntries.map((e, i) => `  screen${i},`).join('\n')}
];
`;
  writeFileSync(path.join(OUT_DIR, 'manifest.js'), manifestSource, 'utf8');
  console.log('generated src/screens/manifest.js');
}

generate();
