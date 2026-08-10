# Markdown Viewer — Feature Roadmap & TODO

> **Scope Restriction**: This extension is and will remain a **local-only, read-only Markdown viewer**. Features requiring GitHub API integration, Git tracking, or external cloud services are intentionally out of scope.

---

## 🎯 Short-Term Tasks (Next Up)

### 1. Webview UI & User Experience Enhancements
- [ ] **Copy Code Button**: Add a "Copy" button to the top-right of fenced code blocks in the preview.
- [ ] **Image Zoom / Lightbox**: Click on an image in the preview to view it in full size or zoom.
- [ ] **Find in Preview**: Support `Ctrl+F` in the preview panel to search within rendered content.
- [ ] **Custom Theme / User CSS**: Allow users to specify a path to a custom CSS file (`markdownViewer.customStyles`) to override preview styling.

### 2. Rendering Capabilities
- [ ] **YAML Frontmatter Support**: Parse and cleanly display (or hide via setting) YAML frontmatter (`---` metadata at top of document).
- [ ] **Footnotes & Abbreviations**: Add `markdown-it-footnote` and `markdown-it-abbr` for footnote references and definition lists.
- [ ] **Subscript & Superscript**: Add `markdown-it-sub` and `markdown-it-sup` for `~subscript~` and `^superscript^`.
- [ ] **Emoji Shortcodes**: Render `:smile:` as 😊 via `markdown-it-emoji`.

---

## 🚀 Mid-Term Features

### 3. Editor & Navigation Integration
- [ ] **Synchronized Scrolling (Editor ↔ Preview)**: Bi-directional scroll sync between the active editor and the preview panel.
- [ ] **Table of Contents (TOC) Sidebar**: Interactive outline/TOC tree view in the preview header or side panel.
- [ ] **In-Document Jump Links**: Enhance anchor clicking so jumping to `#heading-slug` smoothly scrolls the Webview to that section.

### 4. Diagramming & Mathematics (Local Rendering)
- [ ] **Mermaid Diagram Support**: Render ````mermaid` blocks locally using Mermaid.js inside the Webview.
- [ ] **Math Expressions (LaTeX / KaTeX)**: Render inline `$E=mc^2$` and block `$$...$$` math equations locally via KaTeX or MathJax.

---

## 📦 Long-Term / Export Features

### 5. Export Capabilities
- [ ] **Export to HTML**: Command `Markdown Viewer: Export to HTML` to save the standalone, styled HTML document.
- [ ] **Print / Save as PDF**: Command `Markdown Viewer: Print / Export to PDF`.

---

## ❌ Non-Goals (Explicitly Out of Scope)

- **No GitHub API / Auth**: No repositories, issues, PRs, or Actions integration.
- **No Git Integration**: No git blame, diff views, or commit tracking.
- **No Markdown Editing**: No WYSIWYG editing, line formatting commands, or text mutation.
- **No Remote/Cloud Services**: No external rendering servers, telemetry tracking, or cloud sync.
