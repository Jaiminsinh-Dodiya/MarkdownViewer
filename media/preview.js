// Markdown Viewer preview client script.
//
// Responsibilities:
//  1. Intercept external link clicks → route through VS Code's openExternal.
//  2. Copy-to-clipboard button on fenced code blocks.
//  3. Image lightbox (click-to-zoom overlay).
//  4. Callout block fold/collapse toggle.
//  5. Mermaid diagram initialization.
//  6. Incremental updates (Phase 0 message handling) with scroll preservation.
//  7. Bi-directional scroll sync (scrollToLine and revealLine).
//  8. TOC Sidebar & IntersectionObserver scroll-spy.
//  9. In-Preview Find / Search bar (Ctrl+F).
//
(function () {
  const vscode = acquireVsCodeApi();

  let currentHeadings = [];
  let isScrollingFromEditor = false;
  let scrollDebounceTimer = null;
  let lastEditorScrollTime = 0;
  const SCROLL_COOLDOWN_MS = 200;

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

    if (href.startsWith('#')) {
      event.preventDefault();
      const id = href.slice(1);
      const targetEl = document.getElementById(id);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      event.preventDefault();
    }
  });

  // ── Inbound Message Listener (Phase 0, Scroll Sync, Updates) ──────────

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || !message.type) { return; }

    switch (message.type) {
      case 'update':
        handleIncrementalUpdate(message);
        break;

      case 'scrollToLine':
        handleScrollToLine(message.line);
        break;
    }
  });

  function handleIncrementalUpdate(msg) {
    const savedY = window.scrollY;
    const content = document.getElementById('markdown-viewer-content');

    if (content && typeof msg.html === 'string') {
      content.innerHTML = msg.html;
    }

    if (msg.headings) {
      currentHeadings = msg.headings;
      renderToc(msg.headings);
    }

    if (msg.stats) {
      updateStats(msg.stats);
    }

    // Re-run idempotent initializers on new content
    initCopyButtons();
    initCalloutToggles();
    initMermaid();
    setupScrollSpy();

    const findInput = document.getElementById('mv-find-input');
    if (findInput && findInput.value) {
      performSearch(findInput.value);
    }

    // Restore scroll position unless editor scroll was active
    if (!isScrollingFromEditor) {
      window.scrollTo(0, savedY);
    }
    isScrollingFromEditor = false;
  }

  function handleScrollToLine(targetLine) {
    if (!targetLine) { return; }
    isScrollingFromEditor = true;
    lastEditorScrollTime = Date.now();

    // Find exact or closest [data-line] element
    const elements = document.querySelectorAll('[data-line]');
    let bestMatch = null;
    let minDiff = Infinity;

    elements.forEach((el) => {
      const line = parseInt(el.getAttribute('data-line') || '0', 10);
      const diff = Math.abs(line - targetLine);
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = el;
      }
    });

    if (bestMatch) {
      bestMatch.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── Preview -> Editor Scroll Sync ───────────────────────────────────────

  window.addEventListener('scroll', () => {
    if (Date.now() - lastEditorScrollTime < SCROLL_COOLDOWN_MS) {
      return; // Ignore preview scroll triggered by editor sync
    }

    if (scrollDebounceTimer) {
      cancelAnimationFrame(scrollDebounceTimer);
    }

    scrollDebounceTimer = requestAnimationFrame(() => {
      const elements = document.querySelectorAll('[data-line]');
      let topElement = null;
      const viewportTop = window.scrollY + 100;

      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        if (absoluteTop <= viewportTop) {
          topElement = elements[i];
        } else {
          break;
        }
      }

      if (topElement) {
        const line = parseInt(topElement.getAttribute('data-line') || '1', 10);
        vscode.postMessage({ type: 'revealLine', line });
      }
    });
  }, { passive: true });

  // ── Copy Code Button ────────────────────────────────────────────────────

  function initCopyButtons() {
    document.querySelectorAll('pre').forEach((pre) => {
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

        const markCopied = () => {
          btn.classList.add('copied');
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(markCopied).catch(() => {
            // Webview clipboard fallback
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); markCopied(); } catch (_) {}
            document.body.removeChild(ta);
          });
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); markCopied(); } catch (_) {}
          document.body.removeChild(ta);
        }
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
      // event.target IS the img element (leaf node) — closest() only works going up,
      // so we check the target itself first, then try closest() as a fallback.
      const img = (event.target instanceof HTMLImageElement ? event.target : null) ||
                  event.target.closest('img');
      if (!img || !content.contains(img) || img.closest('a')) { return; }

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

      overlay.offsetHeight;
      overlay.classList.add('active');

      function closeLightbox() {
        overlay.classList.remove('active');
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
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
      title.onclick = () => {
        const callout = title.closest('.mv-callout');
        if (callout) {
          callout.classList.toggle('is-collapsed');
        }
      };
    });
  }

  // ── Mermaid Diagram Initialization ──────────────────────────────────────

  function initMermaid() {
    // mermaid v10+ ships as an ES module; the bundled IIFE exposes it on window.mermaid.
    const mermaidApi = typeof window.mermaid !== 'undefined' ? window.mermaid : null;
    if (!mermaidApi) { return; }

    const body = document.body;
    const isDark = body.classList.contains('vscode-dark') || body.classList.contains('vscode-high-contrast');

    try {
      mermaidApi.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'antiscript',  // 'strict' uses iframe (breaks in webview CSP), 'antiscript' strips scripts safely
        fontFamily: 'sans-serif',
      });
    } catch (e) { /* already initialized */ }

    document.querySelectorAll('.mermaid:not(.mermaid-rendered)').forEach(async (el, index) => {
      const code = el.textContent || '';
      if (!code.trim()) { return; }

      try {
        const uniqueId = `mermaid-svg-${Date.now()}-${index}`;
        const { svg } = await mermaidApi.render(uniqueId, code);
        el.innerHTML = svg;
        el.classList.add('mermaid-rendered');
      } catch (err) {
        console.warn('Mermaid render error:', err);
        el.innerHTML = `<pre class="mermaid-error">Diagram error: ${err && err.message ? err.message : err}</pre>`;
      }
    });
  }

  // ── Interactive TOC Sidebar & Scroll-Spy ────────────────────────────────

  let tocObserver = null;

  function renderToc(headings) {
    const container = document.getElementById('mv-toc-content');
    if (!container) { return; }

    container.innerHTML = '';
    if (!headings || headings.length === 0) {
      container.innerHTML = '<div style="opacity:0.6; padding:10px; font-size:0.8rem;">No headings in document</div>';
      return;
    }

    headings.forEach((h) => {
      const a = document.createElement('a');
      a.className = `mv-toc-item level-${h.level}`;
      a.href = `#${h.slug}`;
      a.textContent = h.text;
      a.setAttribute('data-slug', h.slug);

      a.addEventListener('click', (e) => {
        e.preventDefault();
        const targetEl = document.getElementById(h.slug);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      container.appendChild(a);
    });
  }

  function setupScrollSpy() {
    if (tocObserver) {
      tocObserver.disconnect();
    }

    const headingEls = document.querySelectorAll('.markdown-viewer-content h1[id], .markdown-viewer-content h2[id], .markdown-viewer-content h3[id], .markdown-viewer-content h4[id], .markdown-viewer-content h5[id], .markdown-viewer-content h6[id]');
    if (headingEls.length === 0) { return; }

    tocObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          document.querySelectorAll('.mv-toc-item').forEach((item) => {
            if (item.getAttribute('data-slug') === id) {
              item.classList.add('active');
            } else {
              item.classList.remove('active');
            }
          });
        }
      });
    }, { rootMargin: '0px 0px -65% 0px' });

    headingEls.forEach((el) => tocObserver.observe(el));
  }

  function initTocControls() {
    const toggleBtn = document.getElementById('mv-toc-toggle');
    const closeBtn = document.getElementById('mv-toc-close');
    const sidebar = document.getElementById('mv-toc-sidebar');
    const mainWrapper = document.getElementById('mv-main-wrapper');

    function toggleToc() {
      if (!sidebar) { return; }
      const isOpen = sidebar.classList.toggle('open');
      if (mainWrapper) {
        mainWrapper.style.marginRight = isOpen ? '260px' : '0';
      }
    }

    if (toggleBtn) { toggleBtn.addEventListener('click', toggleToc); }
    if (closeBtn) { closeBtn.addEventListener('click', toggleToc); }

    // On first load, populate TOC from headings already in the rendered DOM.
    initTocFromDom();
  }

  function initTocFromDom() {
    const container = document.getElementById('mv-toc-content');
    if (!container || container.children.length > 0) { return; } // already populated

    const headingEls = document.querySelectorAll(
      '.markdown-viewer-content h1[id], .markdown-viewer-content h2[id], ' +
      '.markdown-viewer-content h3[id], .markdown-viewer-content h4[id], ' +
      '.markdown-viewer-content h5[id], .markdown-viewer-content h6[id]'
    );

    const headings = [];
    headingEls.forEach((el) => {
      const level = parseInt(el.tagName.slice(1), 10);
      const slug = el.id;
      // Strip the permalink anchor text from the heading text
      const text = (el.textContent || '').replace(/#$/, '').trim();
      headings.push({ level, slug, text });
    });

    if (headings.length > 0) {
      currentHeadings = headings;
      renderToc(headings);
    }
  }

  // ── Document Stats Update ───────────────────────────────────────────────

  function updateStats(stats) {
    if (!stats) { return; }
    const wordsEl = document.getElementById('mv-stat-words');
    const charsEl = document.getElementById('mv-stat-chars');
    const linesEl = document.getElementById('mv-stat-lines');
    const readingEl = document.getElementById('mv-stat-reading');

    if (wordsEl) { wordsEl.textContent = `${stats.words} words`; }
    if (charsEl) { charsEl.textContent = `${stats.chars} chars`; }
    if (linesEl) { linesEl.textContent = `${stats.lines} lines`; }
    if (readingEl) { readingEl.textContent = `${stats.readingTimeMin} min read`; }
  }

  // ── In-Preview Find / Search Bar (Ctrl+F) ───────────────────────────────

  let searchMatches = [];
  let currentMatchIndex = -1;

  function initFindBar() {
    const findBar = document.getElementById('mv-find-bar');
    const findInput = document.getElementById('mv-find-input');
    const findCount = document.getElementById('mv-find-count');
    const prevBtn = document.getElementById('mv-find-prev');
    const nextBtn = document.getElementById('mv-find-next');
    const closeBtn = document.getElementById('mv-find-close');
    const searchToggle = document.getElementById('mv-search-toggle');

    if (!findBar || !findInput) { return; }

    function openFindBar() {
      findBar.style.display = 'flex';
      findInput.focus();
      findInput.select();
    }

    function closeFindBar() {
      findBar.style.display = 'none';
      clearSearchHighlights();
    }

    // Capture Ctrl+F / Cmd+F inside Webview
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFindBar();
      } else if (e.key === 'Escape' && findBar.style.display !== 'none') {
        closeFindBar();
      }
    });

    if (searchToggle) { searchToggle.addEventListener('click', openFindBar); }
    if (closeBtn) { closeBtn.addEventListener('click', closeFindBar); }

    findInput.addEventListener('input', () => {
      performSearch(findInput.value);
    });

    findInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          navigateMatch(-1);
        } else {
          navigateMatch(1);
        }
      }
    });

    if (prevBtn) { prevBtn.addEventListener('click', () => navigateMatch(-1)); }
    if (nextBtn) { nextBtn.addEventListener('click', () => navigateMatch(1)); }
  }

  function clearSearchHighlights() {
    document.querySelectorAll('mark.mv-search-hit').forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
    searchMatches = [];
    currentMatchIndex = -1;
    updateFindCount();
  }

  function performSearch(query) {
    clearSearchHighlights();
    if (!query || query.trim() === '') { return; }

    const content = document.getElementById('markdown-viewer-content');
    if (!content) { return; }

    const textNodes = [];
    const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walk.nextNode())) {
      // Skip text nodes inside copy buttons or toolbar controls
      if (node.parentNode && !node.parentNode.closest('.mv-copy-btn, .mv-toolbar, .mv-find-bar, script, style')) {
        textNodes.push(node);
      }
    }

    const lowerQuery = query.toLowerCase();

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue || '';
      const lowerText = text.toLowerCase();
      let index = lowerText.indexOf(lowerQuery);

      if (index >= 0) {
        const fragment = document.createDocumentFragment();
        let lastIdx = 0;

        while (index >= 0) {
          fragment.appendChild(document.createTextNode(text.slice(lastIdx, index)));
          const matchMark = document.createElement('mark');
          matchMark.className = 'mv-search-hit';
          matchMark.textContent = text.slice(index, index + query.length);
          fragment.appendChild(matchMark);
          searchMatches.push(matchMark);

          lastIdx = index + query.length;
          index = lowerText.indexOf(lowerQuery, lastIdx);
        }

        fragment.appendChild(document.createTextNode(text.slice(lastIdx)));
        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(fragment, textNode);
        }
      }
    });

    if (searchMatches.length > 0) {
      currentMatchIndex = 0;
      highlightCurrentMatch();
    }
    updateFindCount();
  }

  function navigateMatch(dir) {
    if (searchMatches.length === 0) { return; }
    currentMatchIndex = (currentMatchIndex + dir + searchMatches.length) % searchMatches.length;
    highlightCurrentMatch();
    updateFindCount();
  }

  function highlightCurrentMatch() {
    searchMatches.forEach((m, idx) => {
      if (idx === currentMatchIndex) {
        m.classList.add('active');
        m.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        m.classList.remove('active');
      }
    });
  }

  function updateFindCount() {
    const countEl = document.getElementById('mv-find-count');
    if (!countEl) { return; }
    if (searchMatches.length === 0) {
      countEl.textContent = '0 of 0';
    } else {
      countEl.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
    }
  }

  // ── Initialize Everything ───────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    initCopyButtons();
    initLightbox();
    initCalloutToggles();
    initMermaid();
    initTocControls();
    initFindBar();
    setupScrollSpy();
  });

  if (document.readyState !== 'loading') {
    initCopyButtons();
    initLightbox();
    initCalloutToggles();
    initMermaid();
    initTocControls();
    initFindBar();
    setupScrollSpy();
  }
})();
