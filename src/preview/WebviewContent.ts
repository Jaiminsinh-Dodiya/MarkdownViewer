import * as vscode from 'vscode';
import { DocumentStats, MarkdownHeading } from '../markdown/MarkdownTypes';
import { buildContentSecurityPolicy, generateNonce } from './WebviewSecurity';

export interface WebviewContentOptions {
  bodyHtml: string;
  maxContentWidth: number;
  warnings: string[];
  enableMath: boolean;
  enableMermaid: boolean;
  showToc: boolean;
  showStats: boolean;
  customStylesUri?: vscode.Uri;
  headings: MarkdownHeading[];
  stats?: DocumentStats;
}

/**
 * Assembles the static HTML shell that hosts rendered Markdown.
 */
export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options: WebviewContentOptions
): string {
  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(webview, nonce);

  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'preview.css')
  );
  const highlightStyleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'highlight-theme.css')
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'preview.js')
  );

  let katexStyleTag = '';
  if (options.enableMath) {
    const katexCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'node_modules', 'katex', 'dist', 'katex.min.css')
    );
    katexStyleTag = `<link href="${katexCssUri}" rel="stylesheet">`;
  }

  let mermaidScriptTag = '';
  if (options.enableMermaid) {
    const mermaidJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'vendor', 'mermaid.min.js')
    );
    mermaidScriptTag = `<script nonce="${nonce}" src="${mermaidJsUri}"></script>`;
  }

  let customStyleTag = '';
  if (options.customStylesUri) {
    customStyleTag = `<link href="${options.customStylesUri}" rel="stylesheet">`;
  }

  const warningsHtml =
    options.warnings.length > 0
      ? `<div class="markdown-viewer-warnings">
           ${options.warnings.map((w) => `<div class="markdown-viewer-warning">${escapeForAttribute(w)}</div>`).join('')}
         </div>`
      : '';

  const initialStatsHtml = options.showStats && options.stats
    ? `<footer class="mv-stats-footer" id="mv-stats-footer">
         <span class="mv-stat-item" id="mv-stat-words">${options.stats.words} words</span> • 
         <span class="mv-stat-item" id="mv-stat-chars">${options.stats.chars} chars</span> • 
         <span class="mv-stat-item" id="mv-stat-lines">${options.stats.lines} lines</span> • 
         <span class="mv-stat-item" id="mv-stat-reading">${options.stats.readingTimeMin} min read</span>
       </footer>`
    : '<footer class="mv-stats-footer" id="mv-stats-footer" style="display:none;"></footer>';

  const findBarHtml = `<div class="mv-find-bar" id="mv-find-bar" style="display:none;">
    <input type="text" id="mv-find-input" placeholder="Find in preview..." aria-label="Find in preview">
    <span class="mv-find-count" id="mv-find-count">0 of 0</span>
    <button type="button" class="mv-find-btn" id="mv-find-prev" title="Previous match (Shift+Enter)">▲</button>
    <button type="button" class="mv-find-btn" id="mv-find-next" title="Next match (Enter)">▼</button>
    <button type="button" class="mv-find-btn mv-find-close" id="mv-find-close" title="Close (Esc)">✕</button>
  </div>`;

  const toolbarHtml = `<div class="mv-toolbar" id="mv-toolbar">
    ${options.showToc ? '<button type="button" class="mv-toolbar-btn" id="mv-toc-toggle" title="Toggle Table of Contents"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></button>' : ''}
    <button type="button" class="mv-toolbar-btn" id="mv-search-toggle" title="Find in preview (Ctrl+F)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
    <button type="button" class="mv-toolbar-btn" id="mv-print-btn" title="Print / Save to PDF (Ctrl+P)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
  </div>`;

  const tocSidebarHtml = options.showToc
    ? `<aside class="mv-toc-sidebar" id="mv-toc-sidebar">
         <div class="mv-toc-header">
           <span>Table of Contents</span>
           <button type="button" class="mv-toc-close" id="mv-toc-close" title="Close">✕</button>
         </div>
         <nav class="mv-toc-content" id="mv-toc-content"></nav>
       </aside>`
    : '';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <link href="${highlightStyleUri}" rel="stylesheet">
  ${katexStyleTag}
  ${customStyleTag}
  <style nonce="${nonce}">
    :root { --markdown-viewer-max-width: ${options.maxContentWidth}px; }
  </style>
  <title>Markdown Preview</title>
</head>
<body class="mv-body">
  ${toolbarHtml}
  ${findBarHtml}
  ${tocSidebarHtml}
  <div class="mv-main-wrapper" id="mv-main-wrapper">
    ${warningsHtml}
    <div class="markdown-viewer-content" id="markdown-viewer-content">
      ${options.bodyHtml}
    </div>
    ${initialStatsHtml}
  </div>
  ${mermaidScriptTag}
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function escapeForAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
