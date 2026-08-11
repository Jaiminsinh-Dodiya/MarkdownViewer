# Markdown Viewer — Feature Roadmap & TODO

> **Scope Restriction**: This extension is and will remain a **local-only, read-only Markdown viewer**. Features requiring GitHub API integration, Git tracking, or external cloud services are intentionally out of scope.

---

## ✅ Completed Features (Obsidian-Style Release)

### 🎨 Obsidian Reading Mode Visual System
- [x] **Obsidian Design System**: System UI typography, H1 bottom border accent, radius system (4px/8px/12px), smooth transitions.
- [x] **Obsidian Callout Blocks**: Styled `> [!type]` callouts (13 types with custom SVG icons, tinted backgrounds, left border strip, collapsible `+`/`-` support).
- [x] **Theme Adaptive**: Fully leverages VS Code theme CSS variables with fallback to Obsidian purple (`#7f6df2`).

### 🛠️ UX & Interactive Enhancements
- [x] **Copy Code Button**: Hover-reveal button on fenced code blocks with clipboard copy & visual confirmation feedback.
- [x] **Image Lightbox / Zoom**: Click any image in preview to open a centered fullscreen zoom modal with backdrop dismiss.
- [x] **External Link Interception**: External links (`http`, `https`, `mailto`) open in default browser via `vscode.env.openExternal`.

### 📝 Enhanced Rendering Capabilities
- [x] **YAML Frontmatter Properties**: Parsed and rendered as an Obsidian-style "Properties" card at the top of the preview.
- [x] **Footnotes**: Superscript footnote references `[^1]` and bottom footnotes section with back-links.
- [x] **Subscript & Superscript**: `~subscript~` and `^superscript^` rendering.
- [x] **Emoji Shortcodes**: Render `:smile:` as 😊 via `markdown-it-emoji`.

### 📊 Diagrams & Math (Local Offline)
- [x] **Mermaid Diagrams**: Client-side SVG rendering for ````mermaid` blocks using bundled Mermaid.js.
- [x] **KaTeX Math Rendering**: LaTeX math rendering for inline `$E=mc^2$` and block `$$...$$` equations using bundled KaTeX CSS.

---

## 🎯 Short-Term Tasks (Next Up)

### 1. Webview UI & User Experience Enhancements
- [ ] **Find in Preview**: Support `Ctrl+F` inside the preview panel to search rendered content.
- [ ] **Custom Theme / User CSS**: Allow users to specify a path to a custom CSS file (`markdownViewer.customStyles`) to override preview styling.

### 2. Editor & Navigation Integration
- [ ] **Synchronized Scrolling (Editor ↔ Preview)**: Bi-directional scroll sync between the active editor and the preview panel.
- [ ] **Table of Contents (TOC) Sidebar**: Interactive outline/TOC tree view in the preview header or side panel.
- [ ] **In-Document Jump Links**: Enhance anchor clicking so jumping to `#heading-slug` smoothly scrolls the Webview to that section.

---

## 📦 Long-Term / Export Features

### 3. Export Capabilities
- [ ] **Export to HTML**: Command `Markdown Viewer: Export to HTML` to save the standalone, styled HTML document.
- [ ] **Print / Save as PDF**: Command `Markdown Viewer: Print / Export to PDF`.

---

## ❌ Non-Goals (Explicitly Out of Scope)

- **No GitHub API / Auth**: No repositories, issues, PRs, or Actions integration.
- **No Git Integration**: No git blame, diff views, or commit tracking.
- **No Markdown Editing**: No WYSIWYG editing, line formatting commands, or text mutation.
- **No Remote/Cloud Services**: No external rendering servers, telemetry tracking, or cloud sync.
