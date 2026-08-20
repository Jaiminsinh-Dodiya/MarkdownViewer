import * as vscode from 'vscode';

import { exportHtmlCommand } from './commands/exportHtml';
import { registerOpenPreviewCommand } from './commands/openPreview';
import { registerOpenPreviewToSideCommand } from './commands/openPreviewToSide';
import { registerPrintCommand } from './commands/print';
import { MarkdownItEngine } from './markdown/MarkdownRenderer';
import { MarkdownPreviewProvider } from './preview/MarkdownPreviewProvider';
import { isMarkdownDocument } from './utils/FileUtils';

/**
 * Extension activation.
 *
 * Wires together the engine, preview provider, commands, and event listeners.
 */
export function activate(context: vscode.ExtensionContext): void {
  const engine = new MarkdownItEngine();
  const provider = new MarkdownPreviewProvider(context, engine);

  registerOpenPreviewCommand(context, provider);
  registerOpenPreviewToSideCommand(context, provider);
  registerPrintCommand(context, engine);

  context.subscriptions.push(
    vscode.commands.registerCommand('markdownViewer.exportHtml', (uri?: vscode.Uri) => {
      void exportHtmlCommand(engine, context, uri);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isMarkdownDocument(event.document)) {
        provider.onDocumentChanged(event.document);
      }
    })
  );

  // Editor -> Preview scroll sync listener
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (isMarkdownDocument(event.textEditor.document) && event.visibleRanges.length > 0) {
        const topVisibleLine = event.visibleRanges[0].start.line + 1; // 1-indexed
        provider.postScrollToLine(event.textEditor.document.uri, topVisibleLine);
      }
    })
  );

  // Re-render on configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('markdownViewer')) {
        const document = vscode.window.activeTextEditor?.document;
        if (document && isMarkdownDocument(document) && provider.hasPreview(document.uri)) {
          provider.onDocumentChanged(document);
        }
      }
    })
  );

  // Re-render previews when active color theme changes (e.g. Dark <-> Light)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      provider.refreshAll();
    })
  );

  context.subscriptions.push(provider);
}

export function deactivate(): void {
  // Cleanup is handled via context.subscriptions (provider.dispose()).
}
