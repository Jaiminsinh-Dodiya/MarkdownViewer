import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownEngine } from '../markdown/MarkdownEngine';
import { DEFAULT_RENDER_OPTIONS } from '../markdown/MarkdownTypes';
import { getActiveMarkdownDocument, isMarkdownDocument } from '../utils/FileUtils';

/**
 * Handles the `markdownViewer.exportHtml` command.
 *
 * Exports the active Markdown document as a standalone, self-contained HTML file
 * with embedded inline CSS, bundled syntax themes, KaTeX math styles, and
 * Mermaid diagram support. The exported HTML file requires no external
 * dependencies and opens natively in any web browser.
 */
export async function exportHtmlCommand(
  engine: MarkdownEngine,
  context: vscode.ExtensionContext,
  uri?: vscode.Uri
): Promise<void> {
  let document: vscode.TextDocument | undefined;

  if (uri) {
    document = await vscode.workspace.openTextDocument(uri);
  } else {
    document = getActiveMarkdownDocument();
  }

  if (!document || !isMarkdownDocument(document)) {
    vscode.window.showWarningMessage('No active Markdown file to export.');
    return;
  }

  const docPath = document.uri.fsPath;
  const defaultExportPath = vscode.Uri.file(
    docPath.replace(/\.(md|markdown|mdown|mkdn)$/i, '.html')
  );

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: defaultExportPath,
    saveLabel: 'Export HTML',
    filters: { 'HTML Files': ['html'] }
  });

  if (!saveUri) {
    return; // User cancelled
  }

  try {
    const rendered = engine.render(document.getText(), {
      ...DEFAULT_RENDER_OPTIONS,
      allowHtml: true,
      enableLineTagging: false // Line tags not needed for offline standalone export
    });

    const mediaPath = path.join(context.extensionPath, 'media');
    const previewCss = readAsset(path.join(mediaPath, 'preview.css'));
    const highlightCss = readAsset(path.join(mediaPath, 'highlight-theme.css'));
    const katexCss = readAsset(path.join(context.extensionPath, 'node_modules', 'katex', 'dist', 'katex.min.css'));
    const mermaidJs = readAsset(path.join(mediaPath, 'vendor', 'mermaid.min.js'));

    const title = path.basename(docPath, path.extname(docPath));
    const standaloneHtml = generateStandaloneHtml({
      title,
      bodyHtml: rendered.html,
      previewCss,
      highlightCss,
      katexCss,
      mermaidJs,
      stats: rendered.stats
    });

    await fs.promises.writeFile(saveUri.fsPath, standaloneHtml, 'utf-8');

    const openChoice = await vscode.window.showInformationMessage(
      `Successfully exported to ${path.basename(saveUri.fsPath)}`,
      'Open File'
    );

    if (openChoice === 'Open File') {
      vscode.env.openExternal(saveUri);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Failed to export HTML: ${errorMsg}`);
  }
}

function readAsset(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export interface ExportOptions {
  title: string;
  bodyHtml: string;
  previewCss: string;
  highlightCss: string;
  katexCss: string;
  mermaidJs: string;
  stats: { words: number; chars: number; lines: number; readingTimeMin: number };
  autoPrint?: boolean;
}

export function generateStandaloneHtml(options: ExportOptions): string {
  const statsHtml = `<footer class="mv-stats-footer">
    <span>${options.stats.words} words</span> • 
    <span>${options.stats.chars} chars</span> • 
    <span>${options.stats.lines} lines</span> • 
    <span>${options.stats.readingTimeMin} min read</span>
  </footer>`;

  const printScript = options.autoPrint
    ? `<script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 300);
    });
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttribute(options.title)}</title>
  <style>
    ${options.previewCss}
    ${options.highlightCss}
    ${options.katexCss}
    body { margin: 0; padding: 20px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground, #dcddde); }
    .mv-stats-footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid rgba(128,128,128,0.2); font-size: 0.85em; opacity: 0.7; text-align: center; }
  </style>
</head>
<body>
  <div class="markdown-viewer-content" id="markdown-viewer-content">
    ${options.bodyHtml}
  </div>
  ${statsHtml}
  <script>
    ${options.mermaidJs}
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'strict' });
    }
  </script>
  ${printScript}
</body>
</html>`;
}

function escapeAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
