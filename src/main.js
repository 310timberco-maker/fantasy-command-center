import './styles.css';
import { startRouter, navigate } from './lib/router.js';
import { mountScreen } from './lib/mount.js';
import { mountShell } from './components/appShell.js';
import { generatedScreens } from './screens/manifest.js';

const routeTable = new Map(generatedScreens.map((s) => [s.route, s]));

const APP_ROOT = document.getElementById('app');

function render(path) {
  if (path === '/app') {
    navigate('/app/watch');
    return;
  }

  const screen = routeTable.get(path);

  if (!screen) {
    APP_ROOT.innerHTML = `
      <main class="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span class="material-symbols-outlined text-[40px] text-on-surface-variant">error</span>
        <h1 class="font-headline-lg text-headline-lg text-on-surface">Screen not found</h1>
        <p class="font-body-md text-on-surface-variant">No route is wired up for <code>${path}</code>.</p>
        <a href="#/" class="text-primary underline">Back to start</a>
      </main>`;
    return;
  }

  if (path.startsWith('/app/')) {
    const outlet = mountShell(APP_ROOT, path);
    mountScreen(outlet, screen);
  } else {
    APP_ROOT.className = 'flex flex-col flex-1 min-h-0';
    mountScreen(APP_ROOT, screen);
  }
}

startRouter(render);
