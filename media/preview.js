// Markdown Viewer preview client script.
//
// Responsibilities:
//  1. Intercept external link clicks → route through VS Code's openExternal.
//  2. Copy-to-clipboard button on fenced code blocks.
//  3. Image lightbox (click-to-zoom overlay).
//  4. Callout block fold/collapse toggle.
//  5. Mermaid diagram initialization (if mermaid.js is loaded).
//
// Still intentionally minimal — no framework, no timer, no DOM mutation
// beyond what's needed for these features.
(function () {
  const vscode = acquireVsCodeApi();

  // ── External Link Interception ──────────────────────────────────────────

  document.addEventListener('click', (event) => {
    const target = event.target.closest('a[href]');
    if (!target) { return; }

    const isExternal = target.hasAttribute('data-external-link');
    const href = target.getAttribute('href') || '';

    if (isExternal) {
      event.preventDefault();
      vscode.postMessage({ type: 'openExternalLink', href });
      return;
    }

    // In-document anchor links are allowed; everything else is blocked.
    if (!href.startsWith('#')) {
      event.preventDefault();
    }
  });

  // ── Copy Code Button ────────────────────────────────────────────────────

  function initCopyButtons() {
    document.querySelectorAll('pre').forEach((pre) => {
      // Skip if already has a button or is a mermaid/frontmatter block
      if (pre.querySelector('.mv-copy-btn') || pre.closest('.mermaid') || pre.closest('.mv-frontmatter')) {
        return;
      }

      const btn = document.createElement('button');
      btn.className = 'mv-copy-btn';
      btn.setAttribute('aria-label', 'Copy code');
      btn.setAttribute('title', 'Copy');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code');
        const text = code ? code.textContent || '' : pre.textContent || '';

        navigator.clipboard.writeText(text).then(() => {
          btn.classList.add('copied');
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 2000);
        }).catch(() => {
          // Clipboard API unavailable — fail silently.
        });
      });

      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }

  // ── Image Lightbox ──────────────────────────────────────────────────────

  function initLightbox() {
    const content = document.getElementById('markdown-viewer-content');
    if (!content) { return; }

    content.addEventListener('click', (event) => {
      const img = event.target.closest('.markdown-viewer-content img');
      if (!img || img.closest('a')) { return; } // Don't lightbox linked images

      const overlay = document.createElement('div');
      overlay.className = 'mv-lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Image preview');

      const clone = document.createElement('img');
      clone.src = img.src;
      clone.alt = img.alt || '';
      clone.className = 'mv-lightbox-img';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'mv-lightbox-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

      overlay.appendChild(clone);
      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);

      // Force reflow then add active class for animation
      overlay.offsetHeight;
      overlay.classList.add('active');

      function closeLightbox() {
        overlay.classList.remove('active');
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        // Fallback removal if transition doesn't fire
        setTimeout(() => { if (overlay.parentNode) { overlay.remove(); } }, 400);
      }

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target === closeBtn || closeBtn.contains(e.target)) {
          closeLightbox();
        }
      });

      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
          closeLightbox();
          document.removeEventListener('keydown', escHandler);
        }
      });
    });
  }

  // ── Callout Fold/Collapse Toggle ────────────────────────────────────────

  function initCalloutToggles() {
    document.querySelectorAll('.mv-callout.is-collapsible .mv-callout-title').forEach((title) => {
      title.style.cursor = 'pointer';
      title.addEventListener('click', () => {
        const callout = title.closest('.mv-callout');
        if (callout) {
          callout.classList.toggle('is-collapsed');
        }
      });
    });
  }

  // ── Mermaid Diagram Initialization ──────────────────────────────────────

  function initMermaid() {
    if (typeof mermaid === 'undefined') { return; }

    // Detect VS Code theme for mermaid
    const body = document.body;
    const isDark = body.classList.contains('vscode-dark') || body.classList.contains('vscode-high-contrast');

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'var(--mv-font-text, sans-serif)',
    });

    document.querySelectorAll('.mermaid').forEach(async (el, index) => {
      const code = el.textContent || '';
      if (!code.trim()) { return; }

      try {
        const { svg } = await mermaid.render(`mermaid-diagram-${index}`, code);
        el.innerHTML = svg;
        el.classList.add('mermaid-rendered');
      } catch (err) {
        el.innerHTML = '<pre class="mermaid-error">Failed to render Mermaid diagram.</pre>';
      }
    });
  }

  // ── Initialize Everything ───────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initCopyButtons();
    initLightbox();
    initCalloutToggles();
    initMermaid();
  });

  // Also run immediately in case DOMContentLoaded already fired
  if (document.readyState !== 'loading') {
    initCopyButtons();
    initLightbox();
    initCalloutToggles();
    initMermaid();
  }
})();
