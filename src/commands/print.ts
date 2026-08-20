import * as vscode from 'vscode';
import { MarkdownPreviewProvider } from '../preview/MarkdownPreviewProvider';
import { getActiveMarkdownDocument, isMarkdownDocument } from '../utils/FileUtils';

/** Registers `markdownViewer.print`. */
export function registerPrintCommand(
  context: vscode.ExtensionContext,
  provider: MarkdownPreviewProvider
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
        // If no active markdown doc, try printing any visible preview
        const printed = provider.printPreview();
        if (!printed) {
          vscode.window.showInformationMessage(
            'Markdown Viewer: Open a Markdown (.md) file or preview first, then run Print.'
          );
        }
        return;
      }

      if (provider.hasPreview(document.uri)) {
        provider.printPreview(document.uri);
      } else {
        provider.openPreview(document, vscode.ViewColumn.Beside);
        // Small delay to allow the webview DOM to load before triggering print
        setTimeout(() => {
          provider.printPreview(document.uri);
        }, 500);
      }
    }
  );

  context.subscriptions.push(disposable);
}
