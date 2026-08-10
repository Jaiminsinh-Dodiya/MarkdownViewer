# Markdown Viewer — Project Documentation

> **Version**: 0.1.0 (Checkpoint)
> **Last Updated**: 2026-08-10

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [Dependency Flow](#dependency-flow)
  - [Module Responsibilities](#module-responsibilities)
  - [Data Flow: Edit → Preview](#data-flow-edit--preview)
- [Extension Lifecycle](#extension-lifecycle)
- [Rendering Pipeline](#rendering-pipeline)
- [Webview Security Model](#webview-security-model)
- [Configuration Reference](#configuration-reference)
- [Testing Strategy](#testing-strategy)
- [Build & Scripts Reference](#build--scripts-reference)
- [File Reference](#file-reference)
- [Design Decisions & Rationale](#design-decisions--rationale)
- [Contributing Guidelines](#contributing-guidelines)

---

## Overview

Markdown Viewer is a VS Code extension that renders `.md` files in a dedicated preview panel. It is a **local-only, read-only viewer** — it does not edit Markdown, connect to remote services, or integrate with Git/GitHub.

The extension is built with a strict separation of concerns so that each layer can be tested, extended, or replaced independently.

---

## Architecture

### Dependency Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      extension.ts                           │
│            (Activation wiring — stays tiny)                 │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             ▼                        ▼
┌────────────────────┐    ┌───────────────────────────────────┐
│    commands/       │    │           preview/                 │
│  openPreview.ts    │───▶│  MarkdownPreviewProvider.ts       │
│  openPreviewToSide │    │  WebviewContent.ts                │
└────────────────────┘    │  WebviewSecurity.ts               │
                          └──────────────┬────────────────────┘
                                         │
                                         ▼
                          ┌───────────────────────────────────┐
                          │           markdown/                │
                          │  MarkdownEngine.ts    (interface)  │
                          │  MarkdownRenderer.ts  (impl)       │
                          │  MarkdownTypes.ts     (types)      │
                          │  MarkdownUtils.ts     (helpers)    │
                          │                                    │
                          │  ⚠ NO dependency on vscode API    │
                          └───────────────────────────────────┘
```

**Rule**: Dependencies flow downward only. The `markdown/` layer never imports `vscode`.

### Module Responsibilities

| Module | Responsibility | Knows about VS Code? |
|--------|---------------|---------------------|
| `extension.ts` | Activation: wires commands, providers, event listeners | Yes |
| `commands/` | Registers palette commands, validates active editor | Yes |
| `preview/MarkdownPreviewProvider` | Manages Webview panel lifecycle, debounced re-rendering | Yes |
| `preview/WebviewContent` | Builds the HTML shell (CSP, stylesheets, script tag) | Yes |
| `preview/WebviewSecurity` | CSP construction, nonce generation | Yes |
| `markdown/MarkdownEngine` | Interface: `render(source, options) → RenderedMarkdown` | **No** |
| `markdown/MarkdownRenderer` | `markdown-it` based implementation with highlight.js, DOMPurify | **No** |
| `markdown/MarkdownTypes` | Shared types, options, error class | **No** |
| `markdown/MarkdownUtils` | Pure helpers: slugify, escapeHtml, isRemoteResource | **No** |
| `utils/FileUtils` | Document language detection helpers | Yes |
| `utils/UriUtils` | Webview URI resolution, resource root computation | Yes |
| `media/` | Webview assets: CSS, JS (no bundler — served directly) | N/A |

### Data Flow: Edit → Preview

```
User edits .md file
        │
        ▼
onDidChangeTextDocument fires
        │
        ▼
extension.ts → provider.onDocumentChanged(document)
        │
        ▼
MarkdownPreviewProvider (150ms debounce)
        │
        ├─ Reads extension configuration (syntaxHighlighting, allowHtml, maxContentWidth)
        ├─ Builds MarkdownRenderOptions with resolveResourcePath callback
        │
        ▼
MarkdownItEngine.render(source, options)
        │
        ├─ markdown-it parses Markdown → tokens
        ├─ highlight.js processes fenced code blocks
        ├─ Custom rules: heading capture, image resolution, external links, tables, code labels
        ├─ DOMPurify sanitizes output HTML
        │
        ▼
Returns { html, headings, warnings }
        │
        ▼
WebviewContent.getWebviewHtml(webview, extensionUri, { bodyHtml, maxContentWidth, warnings })
        │
        ├─ Generates nonce
        ├─ Builds CSP via WebviewSecurity
        ├─ Assembles full HTML document
        │
        ▼
panel.webview.html = fullHtmlDocument
        │
        ▼
Browser renders in Webview
        │
        └─ preview.js intercepts external link clicks → postMessage → openExternal
```

---

## Extension Lifecycle

### Activation

- **Trigger**: `onLanguage:markdown` — activates when any Markdown file is opened.
- **`activate()`** creates the engine and provider, registers commands and event listeners.
- Everything is pushed into `context.subscriptions` for automatic cleanup.

### Panel Management

- Panels are keyed by document URI (`Map<string, ManagedPanel>`).
- Opening a preview for an already-open document **reveals** the existing panel instead of creating a duplicate.
- Closing a panel removes it from the map and clears any pending debounce timer.
- `retainContextWhenHidden: true` keeps the Webview state when the panel tab is not visible.

### Deactivation

- `deactivate()` is intentionally empty — cleanup is handled via `context.subscriptions` which calls `provider.dispose()`, clearing all panels and timers.

---

## Rendering Pipeline

### markdown-it Configuration

| Option | Value | Rationale |
|--------|-------|-----------|
| `html` | `options.allowHtml` | Controlled by user setting |
| `linkify` | `true` | Auto-detect bare URLs |
| `typographer` | `true` | Smart quotes, dashes |
| `breaks` | `false` | Standard Markdown behavior (double newline for `<br>`) |

### Plugins

| Plugin | Purpose |
|--------|---------|
| `markdown-it-task-lists` | GitHub-style `- [ ]` / `- [x]` checkboxes (display-only, `enabled: false`) |

### Custom Renderer Rules

| Rule | What it does |
|------|-------------|
| `heading_open/close` | Captures headings for outline, stamps `id` slugs, appends hover-revealed `#` permalink |
| `image` | Rewrites relative `src` via `resolveResourcePath` callback, adds `loading="lazy"` |
| `link_open` | Marks `http/https/mailto` links with `data-external-link` and `rel="noopener noreferrer"` |
| `table_open/close` | Wraps tables in `.markdown-viewer-table-wrapper` for horizontal scrolling |
| `fence` | Stamps `data-lang` on `<pre>` for the language label pill |

### Sanitization

- All rendered HTML passes through **DOMPurify** before being placed in the Webview.
- `ADD_ATTR: ['target', 'rel', 'checked', 'disabled']` — permits attributes needed by task lists and link security.
- `ALLOW_UNKNOWN_PROTOCOLS: false` — blocks non-standard URI schemes.
- `<script>` tags are **always stripped**, even with `allowHtml: true`.

---

## Webview Security Model

### Content Security Policy

```
default-src 'none';
img-src     ${webview.cspSource} https: data:;
style-src   ${webview.cspSource} 'nonce-<random>';
script-src  'nonce-<random>';
font-src    ${webview.cspSource};
```

- **No `unsafe-inline` or `unsafe-eval`** — scripts and inline styles require a per-render cryptographic nonce.
- Images are allowed from the Webview resource scheme (local files) and HTTPS (remote images in Markdown).
- The single inline `<style>` block (for `--markdown-viewer-max-width`) uses the same nonce.

### Resource Roots

The Webview may only load local resources from:
1. The Markdown document's own directory.
2. The workspace folder containing the document (if any).
3. The extension's `media/` directory.

### External Link Handling

1. `MarkdownRenderer` marks external links with `data-external-link="true"`.
2. `preview.js` intercepts clicks on these links via `event.preventDefault()`.
3. The script posts a message `{ type: 'openExternalLink', href }` to the extension.
4. `MarkdownPreviewProvider` validates the scheme (`http`, `https`, `mailto` only) and calls `vscode.env.openExternal`.
5. Non-anchor, non-external links are **blocked** — the Webview cannot navigate away from the preview.

---

## Configuration Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `markdownViewer.syntaxHighlighting` | `boolean` | `true` | Enable syntax highlighting for fenced code blocks via highlight.js |
| `markdownViewer.allowHtml` | `boolean` | `false` | Render raw HTML in Markdown source (sanitized via DOMPurify before display) |
| `markdownViewer.maxContentWidth` | `number` | `900` | Maximum pixel width of rendered content for readability on wide monitors |

Configuration changes are detected via `onDidChangeConfiguration` and trigger an immediate re-render of any open preview for the active document.

---

## Testing Strategy

### Test Framework

- **Runner**: `@vscode/test-electron` — downloads and launches a real VS Code instance.
- **Assertion library**: Node.js built-in `assert`.
- **Test UI**: Mocha with `tdd` style (`suite`, `test`).
- **Timeout**: 10 seconds per test.

### Test Coverage

| Area | File | What's tested |
|------|------|--------------|
| Markdown rendering | `test/markdown/MarkdownRenderer.test.ts` | All supported Markdown features (headings, lists, task lists, links, images, code blocks, tables, blockquotes, HR), syntax highlighting, fallback for unknown languages, HTML escaping, sanitization, heading permalinks, code language labels, malformed input resilience |
| Pure utilities | `test/markdown/MarkdownUtils.test.ts` | `slugify`, `isRemoteResource`, `escapeHtml` |
| URI resolution | `test/preview/UriUtils.test.ts` | Relative path resolution, query/hash fragment preservation, fallback on resolution failure, resource root computation |

### Running Tests

```bash
npm test          # Full: compile → lint → test
npm run compile   # Just compile (prerequisite for tests)
```

> **Note**: First run requires network access to download a VS Code test instance.

---

## Build & Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `setup` | `node scripts/setup.js` | One-command project initialization (prereqs, install, compile, lint, verify) |
| `compile` | `tsc -p ./` | One-off TypeScript compilation → `./out/` |
| `watch` | `tsc -watch -p ./` | Incremental compilation on file change |
| `lint` | `eslint src test` | Run ESLint on source and test files |
| `test` | `node ./out/test/runTest.js` | Run test suite inside VS Code instance |
| `pretest` | `npm run compile && npm run lint` | Auto-runs before `test` |
| `package` | `vsce package` | Bundle extension into `.vsix` file |
| `vscode:prepublish` | `npm run compile` | Auto-runs before `vsce publish/package` |

### TypeScript Configuration

- **Target**: ES2021, **Module**: CommonJS
- **Strict mode**: Enabled (strict, noImplicitAny, noUnusedLocals, noUnusedParameters, noImplicitReturns)
- **Source maps**: Enabled for F5 debugging
- **Output**: `./out/` (mirrors `src/` and `test/` structure)

---

## File Reference

```
MarkdownViewer/
├── .vscode/
│   ├── launch.json              # F5 debug: "Run Extension" + "Extension Tests"
│   └── tasks.json               # Build tasks: compile, watch
├── media/
│   ├── preview.css              # Main Webview stylesheet (457 lines, theme-variable driven)
│   ├── highlight-theme.css      # Syntax highlighting theme (VS Code-aware)
│   └── preview.js               # Client script (external link interception only)
├── scripts/
│   └── setup.js                 # One-command project setup (cross-platform, zero dependencies)
├── src/
│   ├── extension.ts             # Activation entry point (~50 lines — wiring only)
│   ├── commands/
│   │   ├── openPreview.ts       # markdownViewer.openPreview command
│   │   └── openPreviewToSide.ts # markdownViewer.openPreviewToSide command
│   ├── markdown/
│   │   ├── MarkdownEngine.ts    # Interface: render(source, options) → RenderedMarkdown
│   │   ├── MarkdownRenderer.ts  # markdown-it implementation (~280 lines)
│   │   ├── MarkdownTypes.ts     # Types, options, defaults, error class
│   │   └── MarkdownUtils.ts     # slugify, escapeHtml, isRemoteResource, isKnownLanguageToken
│   ├── preview/
│   │   ├── MarkdownPreviewProvider.ts  # Webview lifecycle, debounced rendering (~166 lines)
│   │   ├── WebviewContent.ts           # HTML shell builder
│   │   └── WebviewSecurity.ts          # CSP + nonce generation
│   └── utils/
│       ├── FileUtils.ts         # isMarkdownDocument, getActiveMarkdownDocument
│       └── UriUtils.ts          # resolveWebviewResourcePath, computeLocalResourceRoots
├── test/
│   ├── markdown/
│   │   ├── MarkdownRenderer.test.ts    # 15 test cases covering all rendering features
│   │   └── MarkdownUtils.test.ts       # 3 test cases for pure utility functions
│   ├── preview/
│   │   └── UriUtils.test.ts            # 4 test cases for URI resolution
│   ├── suite/
│   │   └── index.ts             # Mocha test suite configuration
│   └── runTest.ts               # VS Code test launcher
├── .gitignore
├── .vscodeignore                # Files excluded from .vsix packaging
├── eslint.config.js             # ESLint flat config (TypeScript rules)
├── LICENSE                      # MIT
├── package.json
├── package-lock.json
├── README.md
├── DOCS.md                      # ← You are here
├── TODO.md                      # Feature roadmap and task backlog
└── tsconfig.json
```

---

## Design Decisions & Rationale

### Why markdown-it (not remark, marked, etc.)?

- **Plugin ecosystem**: Rich plugin support for task lists, footnotes, math, etc. — important for the roadmap.
- **Speed**: Consistently among the fastest CommonMark parsers in benchmarks.
- **Token stream**: Exposes a token-based intermediate representation, making custom renderer rules clean and composable (as used for heading capture, image resolution, etc.).
- **Battle-tested**: Used by VS Code's own built-in Markdown preview.

### Why DOMPurify + JSDOM (not just CSP)?

CSP is a **defense-in-depth backstop**, not a primary sanitizer. CSP can prevent script execution but cannot strip malicious HTML attributes, malformed elements, or data-exfiltration vectors. DOMPurify provides proper DOM-level sanitization. JSDOM is required because DOMPurify needs a DOM implementation and the extension host is a Node.js process, not a browser.

### Why a separate MarkdownEngine interface?

Future rendering modes (strict CommonMark, GitHub-Flavored Markdown with extensions, Mermaid+Math, etc.) should be addable as alternate implementations without touching the preview layer. The interface keeps the door open for a configuration-driven engine swap.

### Why debounce re-renders at 150ms?

Balances responsiveness (feels "live") with CPU efficiency. At 150ms, even fast typists see updates within one keystroke delay, but the extension doesn't re-render on every single character.

### Why `retainContextWhenHidden: true`?

Without this, switching away from the preview tab and back would destroy and recreate the Webview's DOM, causing a visible flash. With it, the Webview stays in memory when hidden. The tradeoff is slightly higher memory usage, which is acceptable for a single preview panel.

### Why no bundler (webpack/esbuild)?

V0.1 has a small dependency surface and the extension loads fast without bundling. A bundler will be introduced when the dependency graph grows large enough to warrant it (e.g., when adding Mermaid or KaTeX).

---

## Contributing Guidelines

1. **Run `node scripts/setup.js`** after cloning — it validates everything.
2. **Use `npm run watch`** during development for incremental compilation.
3. **Press F5** to test in the Extension Development Host.
4. **Keep the architecture rules**:
   - `extension.ts` stays small — wiring only.
   - `markdown/` never imports `vscode`.
   - `preview/` never contains parsing logic.
5. **Add tests** for new rendering features in `test/markdown/`.
6. **Run `npm test`** before pushing.
