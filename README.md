# Markdown Viewer

A clean, fast, secure Markdown preview for Visual Studio Code — a dedicated
viewer panel that renders `.md` files natively inside the editor, with full
VS Code theme integration.

This is **V0.1**: a focused, local Markdown viewer. It does not include
GitHub integration, Git awareness, or Markdown editing — see
[Roadmap](#roadmap) for what's intentionally out of scope for now.

---

## Features

- Dedicated preview panel (open in the active editor group, or beside it)
- Live preview: updates automatically as you edit the source document
- Headings (h1–h6), paragraphs, bold/italic/bold-italic/strikethrough, inline code
- Unordered, ordered, and nested lists
- GitHub-style task lists (`- [ ]` / `- [x]`) — rendered as **display-only**
  checkboxes; editing the Markdown is the only way to change them in V0.1
- Links, with external links opened via VS Code's native "open externally"
  mechanism rather than navigating inside the preview
- Images, with relative paths correctly resolved against the source
  document's location
- Blockquotes, including nested blockquotes
- Fenced code blocks with syntax highlighting (via highlight.js); unknown
  or unsupported languages fall back to plain text instead of erroring
- Tables, including column alignment, wrapped for horizontal scrolling on
  narrow viewports so wide tables don't break the page layout
- Horizontal rules
- Full VS Code theme integration (dark, light, and high-contrast) via
  VS Code's CSS theme variables — nothing is hardcoded

---

## Installation

### From a packaged `.vsix`

1. Run `npm install` and `npm run package` (see [Development](#development)) to produce a `.vsix` file.
2. In VS Code, open the Command Palette and run **Extensions: Install from VSIX...**, then select the file.

### From source, for development

See [Development](#development) below — you can run the extension directly from an Extension Development Host without packaging it.

---

## Usage

1. Open a `.md` file in VS Code.
2. Run one of the commands below from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. The preview renders in a panel and updates automatically as you edit the source file.

## Commands

| Command | Description |
|---|---|
| `Markdown Viewer: Open Preview` | Opens the preview in the active editor group. |
| `Markdown Viewer: Open Preview to the Side` | Opens the preview beside the current editor. Also bound to `Ctrl+K V` / `Cmd+K V` and available as an icon in the editor toolbar. |

Both commands require the active editor to hold a Markdown (`.md`) document; otherwise an informational message is shown instead of a broken preview.

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `markdownViewer.syntaxHighlighting` | `true` | Enable syntax highlighting for fenced code blocks. |
| `markdownViewer.allowHtml` | `false` | Allow raw HTML in Markdown source to be rendered. Even when enabled, all HTML is sanitized before display — see [Security](#security-notes). |
| `markdownViewer.maxContentWidth` | `900` | Maximum width, in pixels, of the rendered Markdown content, for readability on wide monitors. |

---

## Supported Markdown Features

Headings, paragraphs, bold, italic, bold-italic, strikethrough, inline code, unordered/ordered/nested lists, task lists (display-only), links, images (with relative path resolution), blockquotes (including nested), fenced code blocks with syntax highlighting, tables (with alignment), horizontal rules, and standard Markdown escaping.

Not yet supported (see [Roadmap](#roadmap)): Mermaid diagrams, math rendering, frontmatter, GitHub-flavored Markdown extensions beyond task lists, and interactive/editable task lists.

---

## Security Notes

The preview renders inside a VS Code Webview with security treated as a first-class concern:

- **Strict Content Security Policy**: `default-src 'none'`, with narrowly scoped `img-src`, `style-src`, and a nonce-based `script-src`. No `unsafe-inline` or `unsafe-eval`.
- **No arbitrary Webview navigation**: clicking a link never navigates the preview panel itself. External links (`http`, `https`, `mailto`) are intercepted and handed to VS Code's `vscode.env.openExternal`, which opens them in the system browser/mail client.
- **HTML sanitization**: all rendered HTML — including any raw HTML present in the Markdown source, if `markdownViewer.allowHtml` is enabled — is passed through DOMPurify before being placed in the Webview. Raw `<script>` tags and other unsafe constructs are stripped regardless of that setting.
- **Restricted resource roots**: the Webview may only load local resources from the Markdown document's own directory and its containing workspace folder — not the entire filesystem.
- **No code execution from Markdown**: code blocks are rendered as syntax-highlighted text only. Nothing in a Markdown document can execute JavaScript.

---

## Development

### Prerequisites

- Node.js and npm
- Visual Studio Code

### Setup

```bash
npm install
```

### Run the extension

Open this folder in VS Code and press `F5` (or run the **Run Extension** launch configuration). This compiles the extension and opens an Extension Development Host window with it loaded — open a `.md` file there and try the commands.

### Build

```bash
npm run compile   # one-off build
npm run watch      # incremental build on file change
```

### Lint

```bash
npm run lint
```

### Testing

```bash
npm test
```

This compiles the project, lints it, and runs the test suite inside a real VS Code instance via `@vscode/test-electron` (requires network access to download a VS Code test instance on first run). Tests cover:

- The Markdown engine (`test/markdown/`): every supported Markdown feature, syntax-highlighting fallback for unknown languages, HTML sanitization, and resilience against malformed input.
- Webview URI resolution (`test/preview/`): relative image path resolution against the source document, and safe fallback behavior on resolution failure.

### Package

```bash
npm run package
```

Produces a `.vsix` file that can be installed via **Extensions: Install from VSIX...**.

---

## Architecture Overview

The extension is split into three layers with a strict one-way dependency direction: `extension.ts` → commands/preview → Markdown engine. The Markdown engine has **no dependency on the VS Code API**, so it can be tested, reused, or swapped independently of the editor integration.

```
markdown-viewer/
├── src/
│   ├── extension.ts              Activation only: wires commands, providers, listeners. Stays small.
│   ├── commands/                 Command registration (openPreview, openPreviewToSide).
│   ├── markdown/                 The Markdown engine — no VS Code dependency.
│   │   ├── MarkdownEngine.ts     Interface: render(source, options) -> RenderedMarkdown
│   │   ├── MarkdownRenderer.ts   markdown-it based implementation (highlighting, task lists, sanitization).
│   │   ├── MarkdownTypes.ts      Shared types/options/errors.
│   │   └── MarkdownUtils.ts      Small pure helpers (slugify, escaping, URI classification).
│   ├── preview/                  Owns Webview lifecycle; connects documents to the engine.
│   │   ├── MarkdownPreviewProvider.ts
│   │   ├── WebviewContent.ts     Builds the HTML shell.
│   │   └── WebviewSecurity.ts    CSP + nonce generation.
│   └── utils/                    VS Code-specific helpers (URI resolution, document detection).
├── media/                        Webview assets: preview.css, highlight-theme.css, preview.js.
└── test/                         Mirrors src/ for markdown and preview layers.
```

**Responsibility rules**, enforced by convention:

- `extension.ts` never contains rendering logic — only activation wiring.
- The Markdown engine never imports `vscode` — resource resolution is injected via a callback (`MarkdownRenderOptions.resolveResourcePath`) supplied by the preview layer.
- The preview provider never contains Markdown parsing logic — it only connects documents, the engine, and the Webview.

This separation is what allows future capabilities (GitHub-flavored Markdown, Mermaid, math, a documentation graph, GitHub API integration) to be added as new engine implementations or new provider layers without rewriting the rendering core.

---

## Roadmap

Deliberately **not** implemented in V0.1 (see [Non-Goals](#non-goals-for-v01)), but the architecture is intended to accommodate these without a rewrite:

- GitHub-flavored Markdown extensions
- Interactive/editable task lists
- Mermaid diagram rendering
- Math rendering
- Frontmatter support
- Git repository awareness and relative-document navigation
- Broken-link detection and a Markdown document graph
- GitHub API integration: repositories, issues, pull requests, Actions
- Documentation validation/search

### Non-Goals for V0.1

To keep this release focused, the following are explicitly out of scope right now: GitHub API/auth/Actions, Git integration, an issue/PR viewer, a Markdown editor or formatting commands, a repository graph, documentation search, Mermaid, math rendering, publishing, cloud sync, AI features, remote/online rendering, and any external backend or server. This is a **local Markdown viewer**.
