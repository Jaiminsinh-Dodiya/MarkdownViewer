# Markdown Viewer (v0.3.0)

A clean, fast, secure, feature-rich Markdown preview extension for Visual Studio Code. Renders `.md` files natively inside the editor using an **Obsidian-inspired Reading Mode** design system, full VS Code theme integration, and 100% local offline rendering.

---

## ✨ Feature Overview

### 🎨 Obsidian Reading Mode Visual System & Custom CSS
- **Obsidian Design System**: System UI typography (Inter font stack), H1 bottom border accent, border-radius hierarchy (`4px`/`8px`/`12px`), zebra-striped tables, and fast transitions.
- **Obsidian Callout Blocks**: Styled `> [!type]` callouts (13 supported types with custom SVG icons, tinted backgrounds, left border strip, and collapsible `+`/`-` support).
- **Custom User CSS**: Setting `markdownViewer.customStyles` allows specifying a path to a custom `.css` file to style the preview panel.

### 🛠️ Interactive & Reading Enhancements
- **Bi-Directional Scroll Sync**: Scrolling in the editor automatically scrolls the preview to the matching line (`LineTaggingPlugin`); scrolling in the preview reveals the line in the editor. Includes a 200ms cooldown loop protection.
- **Phase 0 Live Incremental Updates**: Text edits update the preview via `postMessage` without reloading the DOM shell. Scroll positions, open find bars, and TOC sidebar states are completely preserved while typing!
- **Interactive TOC Sidebar & Scroll-Spy**: Collapsible TOC tree panel in the Webview with `IntersectionObserver` scroll-spy active section highlighting.
- **In-Preview Search / Find Bar (`Ctrl + F`)**: Press `Ctrl+F` (or `Cmd+F`) inside the preview panel to open a floating find bar with hit highlighting, match counter (`3 of 12`), and Next/Prev navigation.
- **Document Statistics Footer**: Live word count, character count, line count, and estimated reading time displayed in the Webview footer.
- **Hover-to-Copy Code Buttons**: Hovering over any fenced code block reveals a **Copy** button to copy code directly to the system clipboard with checkmark confirmation feedback.
- **Click-to-Zoom Image Lightbox**: Click any image in the preview to expand it into a centered dark overlay modal. Press `Esc` or click the backdrop to dismiss.
- **External Link Safety**: External links (`http`, `https`, `mailto`) open in the system web browser/email client via `vscode.env.openExternal` rather than navigating away inside the webview panel.

### 📄 Standalone HTML Export
- Command **`Markdown Viewer: Export to Standalone HTML`** (`markdownViewer.exportHtml`) generates a single, self-contained `.html` file with embedded inline CSS, KaTeX math styles, and Mermaid JS that opens in any browser offline without requiring VS Code.

### 📊 Diagrams & Math (100% Local Offline)
- **Mermaid Diagrams**: Client-side vector SVG rendering for ````mermaid` blocks using bundled Mermaid.js.
- **KaTeX Math Expressions**: LaTeX math rendering for inline `$E=mc^2$` and block `$$...$$` equations using bundled KaTeX.

### 📝 Extended Syntax Support
- **Highlight Text**: `==highlighted text==` → `<mark>`
- **Inserted Text**: `++inserted text++` → `<ins>`
- **Definition Lists**: `Term` / `: Definition` → `<dl><dt><dd>`
- **Abbreviations**: `*[HTML]: HyperText Markup Language` → `<abbr>`
- **YAML Frontmatter Properties Card**: Parsed and rendered as a metadata card at the top of the file.
- **Footnotes & References**: `[^1]` superscript links and bottom footnotes section with return arrows (`↩`).
- **Subscript & Superscript**: `~subscript~` and `^superscript^` rendering.
- **Emoji Shortcodes**: Render `:smile:` as 😊 via `markdown-it-emoji`.

---

## ⚙️ Extension Settings

| Setting | Default | Description |
|:---|:---:|:---|
| `markdownViewer.scrollSync` | `true` | Bi-directional scroll synchronization between editor and preview. |
| `markdownViewer.showToc` | `true` | Show interactive Table of Contents (TOC) sidebar in the preview. |
| `markdownViewer.showStats` | `true` | Show document statistics (words, lines, reading time) in the preview footer. |
| `markdownViewer.showFrontmatter` | `true` | Show extracted YAML frontmatter as a properties card. |
| `markdownViewer.math` | `true` | Enable KaTeX math rendering for `$inline$` and `$$block$$` expressions. |
| `markdownViewer.mermaid` | `true` | Enable Mermaid diagram rendering for ` ```mermaid ` code blocks. |
| `markdownViewer.syntaxHighlighting` | `true` | Enable syntax highlighting for fenced code blocks. |
| `markdownViewer.allowHtml` | `false` | Allow raw HTML in Markdown source to be rendered (sanitized via DOMPurify). |
| `markdownViewer.maxContentWidth` | `900` | Maximum content width in pixels for readability. |
| `markdownViewer.customStyles` | `""` | Path to a custom CSS file to apply to the preview panel. |

---

## 💻 Commands

| Command | Shortcut | Description |
|:---|:---:|:---|
| `Markdown Viewer: Open Preview` | — | Opens preview in active editor tab. |
| `Markdown Viewer: Open Preview to the Side` | `Ctrl+K V` | Opens preview beside current editor. |
| `Markdown Viewer: Export to Standalone HTML` | — | Exports current Markdown document to a standalone `.html` file. |

---

## 🛠️ Development & Building

```bash
# Setup dependencies and build output
node scripts/setup.js

# Compile TypeScript
npm run compile

# Run linter
npm run lint

# Run unit tests
npm test
```

---

## ❌ Non-Goals (Explicitly Out of Scope)

This extension is and will remain a **local-only, read-only Markdown viewer**. Features requiring GitHub API integration, Git tracking, cloud servers, or Markdown text editing commands are intentionally out of scope.
