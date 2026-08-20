import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { MarkdownEngine } from '../markdown/MarkdownEngine';
import { DEFAULT_RENDER_OPTIONS } from '../markdown/MarkdownTypes';
import { getActiveMarkdownDocument, isMarkdownDocument } from '../utils/FileUtils';
import { generateStandaloneHtml } from './exportHtml';

/** Registers `markdownViewer.print`. */
export function registerPrintCommand(
  context: vscode.ExtensionContext,
  engine: MarkdownEngine
): void {
  const disposable = vscode.commands.registerCommand(
    'markdownViewer.print',
    async (uri?: vscode.Uri) => {
      let document: vscode.TextDocument | undefined;

      if (uri) {
        document = await vscode.workspace.openTextDocument(uri);
      } else {
        document = getActiveMarkdownDocument();
      }

      if (!document || !isMarkdownDocument(document)) {
        vscode.window.showInformationMessage(
          'Markdown Viewer: Open a Markdown (.md) file first, then run Print.'
        );
        return;
      }

      try {
        const config = vscode.workspace.getConfiguration('markdownViewer', document.uri);
        const rendered = engine.render(document.getText(), {
          ...DEFAULT_RENDER_OPTIONS,
          allowHtml: config.get<boolean>('allowHtml', false),
          syntaxHighlighting: config.get<boolean>('syntaxHighlighting', true),
          showFrontmatter: config.get<boolean>('showFrontmatter', true),
          enableMath: config.get<boolean>('math', true),
          enableMermaid: config.get<boolean>('mermaid', true),
          mathMacros: config.get<Record<string, string>>('mathMacros', {}),
          enableLineTagging: false
        });

        const mediaPath = path.join(context.extensionPath, 'media');
        const previewCss = readAsset(path.join(mediaPath, 'preview.css'));
        const highlightCss = readAsset(path.join(mediaPath, 'highlight-theme.css'));
        const katexCss = readAsset(path.join(context.extensionPath, 'node_modules', 'katex', 'dist', 'katex.min.css'));
        const mermaidJs = readAsset(path.join(mediaPath, 'vendor', 'mermaid.min.js'));

        const title = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));
        const html = generateStandaloneHtml({
          title,
          bodyHtml: rendered.html,
          previewCss,
          highlightCss,
          katexCss,
          mermaidJs,
          stats: rendered.stats,
          autoPrint: true
        });

        const tempDir = os.tmpdir();
        const safeBaseName = title.replace(/[^a-zA-Z0-9_-]/g, '_');
        const tempFilePath = path.join(tempDir, `mv-print-${safeBaseName}-${Date.now()}.html`);

        await fs.promises.writeFile(tempFilePath, html, 'utf-8');
        await vscode.env.openExternal(vscode.Uri.file(tempFilePath));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Markdown Viewer: Failed to open print dialog: ${errorMsg}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

function readAsset(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}
