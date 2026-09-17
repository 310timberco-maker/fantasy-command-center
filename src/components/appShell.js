// Shared shell for every /app/* route: the five primary screens (Watch,
// Itinerary, Matchups, Players, Activity) plus the Leagues hub all render
// inside this one shell so they share identical navigation chrome.
//
// The bottom tab bar reuses the exact markup/classes Stitch generated for
// the main screens' own nav (see screens/watch-now-*.html) - we only added
// one extra tab (Itinerary) so all five required screens are reachable from
// the shared nav, and standardized on the blue "active" treatment that
// most of the exported screens already used (Watch Now's export was the
// one outlier using an inline amber active color).

const TABS = [
  { path: '/app/watch', icon: 'live_tv', label: 'Watch' },
  { path: '/app/itinerary', icon: 'calendar_month', label: 'Itinerary' },
  { path: '/app/matchups', icon: 'scoreboard', label: 'Matchups' },
  { path: '/app/players', icon: 'shield_person', label: 'Players' },
  { path: '/app/activity', icon: 'bolt', label: 'Activity' },
  { path: '/app/leagues', icon: 'military_tech', label: 'Leagues' },
];

function tabHtml(tab, activePath) {
  // /app/leagues/weekly-setup should still highlight the Leagues tab.
  const isActive = activePath === tab.path || (tab.path === '/app/leagues' && activePath.startsWith('/app/leagues'));
  const colorClass = isActive ? 'text-primary font-bold' : 'text-[#8F9AA8] hover:text-[#F3F5F7]';
  const badge = tab.path === '/app/activity'
    ? '<span class="absolute -top-0.5 -right-1 w-2 h-2 rounded-full" style="background: #EF4650;"></span>'
    : '';
  return `<a aria-current="${isActive ? 'page' : 'false'}" class="relative flex flex-col items-center justify-center gap-1 h-full transition-colors ${colorClass}" data-path="${tab.path}" href="#${tab.path}">
    <div class="relative"><span class="material-symbols-outlined text-[22px]">${tab.icon}</span>${badge}</div>
    <span class="text-[10px] font-semibold tracking-wider uppercase">${tab.label}</span>
  </a>`;
}

export function renderNav(activePath) {
  return `<nav class="fixed bottom-0 w-full z-50 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-4px_16px_rgba(0,0,0,0.7)]">
    <div class="grid grid-cols-6 items-center h-16 px-1" style="background: rgba(18, 22, 28, 0.98); border-top: 1px solid rgb(52, 60, 72);">
      ${TABS.map((t) => tabHtml(t, activePath)).join('')}
    </div>
  </nav>`;
}

export function mountShell(rootEl, activePath) {
  rootEl.innerHTML = `<div id="shell-outlet" class="flex flex-col flex-1 min-h-0"></div>${renderNav(activePath)}`;
  return rootEl.querySelector('#shell-outlet');
}
