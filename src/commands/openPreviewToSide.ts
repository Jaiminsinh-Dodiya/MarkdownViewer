import * as vscode from 'vscode';
import { MarkdownPreviewProvider } from '../preview/MarkdownPreviewProvider';
import { getActiveMarkdownDocument } from '../utils/FileUtils';

/** Registers `markdownViewer.openPreviewToSide`. */
export function registerOpenPreviewToSideCommand(
  context: vscode.ExtensionContext,
  provider: MarkdownPreviewProvider
): void {
  const disposable = vscode.commands.registerCommand('markdownViewer.openPreviewToSide', () => {
    const document = getActiveMarkdownDocument();
    if (!document) {
      vscode.window.showInformationMessage(
        'Markdown Viewer: Open a Markdown (.md) file first, then run this command.'
      );
      return;
    }
    provider.openPreview(document, vscode.ViewColumn.Beside);
  });

  context.subscriptions.push(disposable);
}
