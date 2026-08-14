# Markdown Viewer — Technical Documentation & Architecture (v0.3.0)

This document provides a comprehensive technical overview of the architecture, data flow, security model, and component interactions of the **Markdown Viewer** VS Code extension.

---

## 🏗️ Architecture Overview

The extension follows a strict 3-tier architecture with clean separation of concerns:

```
src/
├── extension.ts                    Activation & event listener wiring
├── commands/
│   ├── openPreview.ts              Open preview command
│   ├── openPreviewToSide.ts        Open preview beside command
│   └── exportHtml.ts               Standalone HTML export handler
├── markdown/                       Markdown Engine Layer (ZERO VS Code dependency)
│   ├── MarkdownEngine.ts           Engine interface contract
│   ├── MarkdownRenderer.ts         markdown-it renderer implementation
│   ├── MarkdownTypes.ts            Data interfaces (headings, stats, render options)
│   ├── MarkdownUtils.ts            Pure utility functions (slugify, escaping)
│   ├── CalloutPlugin.ts            Obsidian callout block plugin (> [!type])
│   └── LineTaggingPlugin.ts        Core-ruler line tagging plugin (data-line="L")
├── preview/                        Preview Webview Layer
│   ├── MarkdownPreviewProvider.ts  Manages Webview panel lifecycle & scroll sync
│   ├── WebviewContent.ts           Assembles static HTML shell & CSP tags
│   └── WebviewSecurity.ts          Content Security Policy & Nonce generation
└── utils/                          VS Code environment helpers (URI resolution)
```

---

## 🔄 Live Incremental Update Flow (Phase 0)

1. **Initial Load**:
   - `MarkdownPreviewProvider.openPreview()` creates the `WebviewPanel`.
   - `renderInto()` calls `engine.render()`.
   - On first load, `panel.webview.html = getWebviewHtml(...)` sets the static HTML shell.
   - `hasLoadedInitialHtml` is set to `true`.

2. **Live Edits**:
   - As the user types in the editor, `onDidChangeTextDocument` fires (debounced 150ms).
   - `renderInto()` detects `hasLoadedInitialHtml === true`.
   - Instead of replacing `panel.webview.html`, it sends an incremental update message:
     `panel.webview.postMessage({ type: 'update', html, headings, warnings, frontmatter, stats })`.
   - `preview.js` receives `type: 'update'`, preserves `window.scrollY`, updates `#markdown-viewer-content.innerHTML`, and re-runs initializers (`initCopyButtons`, `initCalloutToggles`, `initMermaid`, `renderToc`, `updateStats`).

---

## 🔄 Bi-Directional Scroll Sync Protocol

1. **Editor → Preview**:
   - `vscode.window.onDidChangeTextEditorVisibleRanges` calculates the top visible line number `L`.
   - `MarkdownPreviewProvider.postScrollToLine(uri, L)` checks 200ms cooldown and posts `{ type: 'scrollToLine', line: L }` to Webview.
   - `preview.js` queries `[data-line]` elements, finds the closest line match, and calls `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`.

2. **Preview → Editor**:
   - `preview.js` listens to `window.scroll` events (throttled via `requestAnimationFrame`).
   - Finds top visible element with `[data-line]` attribute.
   - Posts `{ type: 'revealLine', line }` back to the extension host.
   - `MarkdownPreviewProvider` updates `lastSyncFromPreviewTime` and calls `editor.revealRange(range, InCenterIfOutsideViewport)`.

---

## 🔒 Security Model

- **Content Security Policy**: `default-src 'none'`, strict nonce-based `script-src`, strict `style-src` with `webview.cspSource`.
- **Link Interception**: External links (`http`, `https`, `mailto`) have `data-external-link="true"` stamped. Clicking them intercepts navigation and delegates to `vscode.env.openExternal`.
- **HTML Sanitization**: All rendered output runs through `DOMPurify.sanitize()` with an explicit attribute allowlist (`['target', 'rel', 'checked', 'disabled', 'data-callout', 'data-line', 'data-external-link']`).
