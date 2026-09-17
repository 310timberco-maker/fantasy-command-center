// Injects a screen's markup and re-executes its inline <script> (elements
// created via innerHTML never auto-run their <script> tags, so each
// generated screen module ships its script text separately and we replay it
// as a freshly created <script> element, which the browser does execute).

export function mountScreen(container, screenModule) {
  container.innerHTML = screenModule.html;
  if (screenModule.inlineScript && screenModule.inlineScript.trim()) {
    // Wrapped in an IIFE: a screen can be mounted more than once per SPA
    // session (the user navigates away and back), and Stitch's inline
    // scripts declare top-level `const`/`let` bindings that would otherwise
    // collide with themselves on re-execution in the same global scope.
    const script = document.createElement('script');
    script.textContent = `(function () {\n${screenModule.inlineScript}\n})();`;
    container.appendChild(script);
  }
  container.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}
