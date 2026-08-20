# Markdown Viewer — Feature Roadmap & TODO

> **Scope Restriction**: This extension is and will remain a **local-only, read-only Markdown viewer**. Features requiring GitHub API integration, Git tracking, or external cloud services are intentionally out of scope.

---

## 🐞 v0.3.0 Fixed Bugs

- [x] **Callout Collapse**: Fixed JS event listeners and CSS rotation.
- [x] **Image Lightbox Position**: Fixed flexbox/absolute positioning by removing transforms from body.
- [x] **Find Bar Position**: Repositioned to avoid overlapping the toolbar buttons.
- [x] **Math Equation Styling**: Fixed CSP nonce blocking KaTeX inline styles.
- [x] **TOC Sidebar Layout**: Changed TOC to a pure overlay (z-index 120) to prevent layout shifting and toolbar overlapping.

---

## ✅ Completed Features (v0.3.0 Feature-Rich Release)

### 🎨 Obsidian Reading Mode Visual System & Custom CSS
- [x] **Obsidian Design System**: System UI typography, H1 bottom border accent, radius system (4px/8px/12px), smooth transitions.
- [x] **Obsidian Callout Blocks**: Styled `> [!type]` callouts (13 types with custom SVG icons, tinted backgrounds, left border strip, collapsible `+`/`-` support).
- [x] **Custom User CSS**: Setting `markdownViewer.customStyles` to load custom user stylesheets into the Webview.

### 🛠️ UX & Interactive Enhancements
- [x] **Phase 0 Incremental Updates**: Live text changes post `postMessage` updates, preserving scroll positions, open find bars, and TOC states.
- [x] **Bi-Directional Scroll Sync**: Editor ↔ Preview scroll synchronization with `LineTaggingPlugin` and 200ms cooldown loop protection.
- [x] **Interactive TOC Sidebar & Scroll-Spy**: Collapsible TOC tree panel with `IntersectionObserver` scroll-spy highlighting active section.
- [x] **In-Preview Search / Find Bar (`Ctrl+F`)**: Floating search bar with match count (`3 of 12`), Next/Prev navigation, and yellow hit highlights.
- [x] **Document Statistics Footer**: Live word count, character count, line count, and estimated reading time.
- [x] **Standalone HTML Export Command**: `Markdown Viewer: Export to Standalone HTML` (`markdownViewer.exportHtml`) generates self-contained `.html` files for offline sharing.
- [x] **Copy Code Button**: Hover-reveal button on fenced code blocks with clipboard copy & visual confirmation feedback.
- [x] **Image Lightbox / Zoom**: Click any image in preview to open a centered fullscreen zoom modal with backdrop dismiss.

### 📝 Extended Syntax Capabilities
- [x] **Text Mark / Highlight**: `==highlight text==` → `<mark>`
- [x] **Inserted Text**: `++inserted text++` → `<ins>`
- [x] **Definition Lists**: `<dl>`, `<dt>`, `<dd>` via `markdown-it-deflist`.
- [x] **Abbreviations**: `<abbr>` via `markdown-it-abbr`.
- [x] **YAML Frontmatter Properties**: Parsed and rendered as an Obsidian-style "Properties" card at the top of the preview.
- [x] **Footnotes**: Superscript footnote references `[^1]` and bottom footnotes section with back-links.
- [x] **Subscript & Superscript**: `~subscript~` and `^superscript^` rendering.
- [x] **Emoji Shortcodes**: Render `:smile:` as 😊 via `markdown-it-emoji`.

### 📊 Diagrams & Math (Local Offline)
- [x] **Mermaid Diagrams**: Client-side SVG rendering for ````mermaid` blocks using bundled Mermaid.js.
- [x] **KaTeX Math Rendering**: LaTeX math rendering for inline `$E=mc^2$` and block `$$...$$` equations using bundled KaTeX CSS.

---

- [x] **Print / Save as PDF**: Direct command (`markdownViewer.print`), toolbar button, and `@media print` layout optimization.
- [x] **Custom Math Macros**: User-defined KaTeX LaTeX macros in settings (`markdownViewer.mathMacros`).
- [x] **Dynamic Theme Switching**: Automatic re-render on active color theme change.

---

## 🎯 Future Ideas (Local-Only Backlog)

- [ ] **Custom CSS snippet manager**: Multi-file custom stylesheet support.
- [ ] **Table of Contents Export**: Copy or export TOC as markdown list.

## ❌ Non-Goals (Explicitly Out of Scope)

- **No GitHub API / Auth**: No repositories, issues, PRs, or Actions integration.
- **No Git Integration**: No git blame, diff views, or commit tracking.
- **No Markdown Editing**: No WYSIWYG editing, line formatting commands, or text mutation.
- **No Remote/Cloud Services**: No external rendering servers, telemetry tracking, or cloud sync.
