import * as vscode from 'vscode';
import { MarkdownPreviewProvider } from '../preview/MarkdownPreviewProvider';
import { getActiveMarkdownDocument } from '../utils/FileUtils';

/** Registers `markdownViewer.openPreview`. */
export function registerOpenPreviewCommand(
  context: vscode.ExtensionContext,
  provider: MarkdownPreviewProvider
): void {
  const disposable = vscode.commands.registerCommand('markdownViewer.openPreview', () => {
    const document = getActiveMarkdownDocument();
    if (!document) {
      vscode.window.showInformationMessage(
        'Markdown Viewer: Open a Markdown (.md) file first, then run this command.'
      );
      return;
    }
    provider.openPreview(document, vscode.ViewColumn.Active);
  });

  context.subscriptions.push(disposable);
}
