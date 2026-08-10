// Markdown Viewer preview client script.
//
// Intentionally minimal (see spec section 25): its only responsibility is
// preventing arbitrary in-Webview navigation and routing external links
// through VS Code's "open externally" mechanism instead. It does not parse
// Markdown, does not modify the DOM beyond what's needed for that, and does
// not run on a timer or interval.
(function () {
  const vscode = acquireVsCodeApi();

  document.addEventListener('click', (event) => {
    const target = event.target.closest('a[href]');
    if (!target) {
      return;
    }

    const isExternal = target.hasAttribute('data-external-link');
    const href = target.getAttribute('href') || '';

    if (isExternal) {
      event.preventDefault();
      vscode.postMessage({ type: 'openExternalLink', href });
      return;
    }

    // In-document anchor links (e.g. heading links) are allowed to behave
    // normally; anything else that isn't marked external is blocked rather
    // than silently navigating the Webview away from the preview.
    if (!href.startsWith('#')) {
      event.preventDefault();
    }
  });
})();
