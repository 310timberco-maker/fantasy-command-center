// Minimal hash router. The Stitch export's screens already use plain <a href>
// and onclick="location.href=...' navigation, so a hash router lets almost
// all of that markup work completely unmodified (a browser follows
// href="#/app/watch" natively, no click handlers required).

function normalize(hash) {
  const path = hash.replace(/^#/, '') || '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function currentPath() {
  return normalize(window.location.hash);
}

export function navigate(path) {
  window.location.hash = path;
}

export function onRouteChange(handler) {
  const listener = () => handler(currentPath());
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function startRouter(handler) {
  onRouteChange(handler);
  if (!window.location.hash) {
    window.location.hash = '/';
  } else {
    handler(currentPath());
  }
}
