import * as vscode from 'vscode';

import { registerOpenPreviewCommand } from './commands/openPreview';
import { registerOpenPreviewToSideCommand } from './commands/openPreviewToSide';
import { MarkdownItEngine } from './markdown/MarkdownRenderer';
import { MarkdownPreviewProvider } from './preview/MarkdownPreviewProvider';
import { isMarkdownDocument } from './utils/FileUtils';

/**
 * Extension activation.
 *
 * This function is deliberately small: its only job is wiring together
 * the engine, the preview provider, commands, and event listeners.
 * It must never contain rendering or Webview-building logic itself.
 */
export function activate(context: vscode.ExtensionContext): void {
  const engine = new MarkdownItEngine();
  const provider = new MarkdownPreviewProvider(context, engine);

  registerOpenPreviewCommand(context, provider);
  registerOpenPreviewToSideCommand(context, provider);

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isMarkdownDocument(event.document)) {
        provider.onDocumentChanged(event.document);
      }
    })
  );

  // Re-render on configuration changes so toggling settings like
  // syntaxHighlighting or allowHtml takes effect without reopening the panel.
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

  context.subscriptions.push(provider);
}

export function deactivate(): void {
  // Cleanup is handled via context.subscriptions (provider.dispose()).
}
