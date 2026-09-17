# Gridiron Command — Fantasy Command Center

A cross-league fantasy football companion app: it unifies a user's leagues
into one live "what matters right now" view for Sundays. This repo takes the
approved Stitch UI export in `screens/` and `assets/images/` and wires it up
into an actual, navigable app.

## Stack

Plain **Vite + vanilla JS**, no framework. The Stitch export is already
Tailwind-classed HTML with a couple of small inline `<script>` blocks per
screen — there was no existing app in this repo to fit into, so the goal was
to preserve that markup as close to verbatim as possible rather than
re-author it into JSX/React and risk visual drift. A tiny hash router
(`src/lib/router.js`) and one shared shell (`src/components/appShell.js`)
provide the "framework" part.

- **Tailwind** — build-time (PostCSS), not the CDN script the raw export
  used, so the app has no runtime dependency on `cdn.tailwindcss.com`.
  `tailwind.config.js` is the union of every screen's embedded token config
  (they were all the same design-system values).
- **Material Symbols** — self-hosted at `public/fonts/` (see
  `src/styles.css`). Every icon in every screen depends on this one font
  file, so it isn't left as an external Google Fonts dependency. Geist /
  Hanken Grotesk (body/heading text) are still loaded from Google Fonts, same
  as the original export — if that's ever unreachable, text just falls back
  to a system font instead of an icon rendering as a literal word.
- **Images** — served locally from `public/assets/images/` (copied from the
  approved `assets/images/`, which stays untouched as the source of truth).

## How the screens get built

`screens/*.html` are not hand-edited into the app. `scripts/generate-screens.mjs`
mechanically converts each one into `src/screens/*.js`:

1. Extracts the `<body>` content.
2. Pulls out the inline `<script>` block so it can be replayed after mount
   (see below) instead of being silently dropped by `innerHTML`.
3. Fixes asset paths (`../assets/images/` → `/assets/images/`).
4. Replaces Stitch's `{{DATA:SCREEN:SCREEN_NN}}` placeholders with real
   in-app routes, using the single global id→route mapping Stitch used
   consistently across every screen (`SCREEN_24` always meant "go to Watch
   Now", etc).
5. For the five primary screens plus the Leagues hub/weekly-setup screens,
   strips the bottom tab-bar `<nav>` — those routes render inside the shared
   `AppShell`, which supplies one consistent nav instead of each screen
   carrying its own copy.
6. Applies a short, explicit list of interaction patches (`POST_PATCHES`) for
   the handful of buttons Stitch shipped completely inert (a "Skip step"
   with no destination at all, an "uncertain item" review button with
   nothing to expand) — see the comment above `POST_PATCHES` in the script
   for the full list and reasoning.

Re-run it with `npm run generate:screens` any time `screens/*.html` changes.
**Don't hand-edit `src/screens/*.js`** for structural changes — it'll just get
overwritten; change `screens/*.html` and/or `POST_PATCHES` and regenerate
instead.

At runtime, `src/lib/mount.js` sets a screen's `innerHTML` and then re-creates
its extracted `<script>` as a real `<script>` element (wrapped in an IIFE, so
revisiting a screen twice in one session doesn't collide on a repeated
top-level `const`) — this is what makes the original filter buttons, the
bench drawer, the scan animation, the radio-button styling, etc. all still
work without having been rewritten by hand.

## Routes

The five primary screens plus Leagues share one shell (`src/components/appShell.js`)
with a 6-tab bottom nav — the original export's nav had 5 tabs (Watch /
Matchups / Players / Activity / Leagues) and never wired in Itinerary as a
destination; since it's one of the five required primary screens, one tab
was added rather than removing or repurposing any of the original five.

| Route | Screen |
|---|---|
| `/` | Onboarding — Welcome |
| `/onboarding/account` | Create account |
| `/onboarding/leagues/add` | Add first league (screenshot-upload smart setup) |
| `/onboarding/leagues/scoring` | Scoring rules upload |
| `/onboarding/leagues/scoring/review` | Review detected scoring |
| `/onboarding/lineup/scan` | Scan my lineup |
| `/onboarding/lineup/confirm` | Confirm my lineup |
| `/onboarding/lineup/opponent` | Confirm opponent lineup |
| `/onboarding/leagues/status` | Multi-league portfolio status |
| `/onboarding/leagues/bulk-add` | Batch-add remaining leagues |
| `/onboarding/alerts` | Live alert preferences |
| `/onboarding/ready` | "You're ready for Sunday" payoff |
| `/app/watch` | **Watch Now** (shared shell) |
| `/app/itinerary` | **Sunday Command Center Itinerary** (shared shell) |
| `/app/matchups` | **Live Fantasy Matchups** (shared shell) |
| `/app/players` | **Players Exposure Leaderboard** (shared shell) |
| `/app/activity` | **Live Activity Feed** (shared shell) |
| `/app/leagues` | Leagues hub (shared shell) |
| `/app/leagues/weekly-setup` | Weekly re-sync before a new week's games |

Onboarding follows the "upload/import first, infer as much as possible, only
ask about what's missing or uncertain" pattern already designed into the
Stitch screens: screenshot upload drives auto-detection of platform/league/
roster/scoring, and the only screens that stop to ask the user something are
the ones flagging low-confidence detection (an uncertain kicker rule, an
ambiguous FLEX slot, a duplicate-matchup disambiguation) — nothing asks for
information the screenshots already gave it. It supports multiple leagues
throughout (batch screenshot upload sorts captures into distinct leagues, the
leaderboard/matchups/itinerary aggregate across all synced leagues, and nothing
assumes a single-league user).

## Running it

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser. Click "Get Started" on
the welcome screen to walk through onboarding, or jump straight to
`http://localhost:5173/#/app/watch` to land directly on the main app shell.

For a production-style build:

```bash
npm run build
npm run preview -- --port 4173   # http://localhost:4173
```

## QA script

`scripts/smoke-test.mjs` drives a headless browser through the entire
onboarding path (clicking the real buttons, not just visiting routes
directly) and all five primary screens plus the Leagues hub, and fails if it
hits a console error or an empty render. It's intentionally not a listed
devDependency (`npm install` stays fast for someone who just wants to run the
app) — to use it:

```bash
npm install -D playwright
npm run build && npm run preview -- --port 4173 &
node scripts/smoke-test.mjs
```

## Known gaps

- All data is realistic mock data baked directly into the Stitch-authored
  markup (leagues, rosters, scores, activity feed) — there's no backend, and
  no state persists between screens (e.g. confirming a lineup on one screen
  doesn't yet update a shared store the other screens read from). Wiring an
  actual shared data layer on top of this is the natural next step once the
  navigable prototype has been reviewed.
- Designed mobile-first at the Stitch export's own single breakpoint; no
  additional responsive/desktop layout work was added beyond what each
  screen already had.
