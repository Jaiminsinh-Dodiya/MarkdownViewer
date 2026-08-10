import * as vscode from 'vscode';

/** The VS Code language id this extension treats as Markdown. */
export const MARKDOWN_LANGUAGE_ID = 'markdown';

/** True if the given document is one this extension should render. */
export function isMarkdownDocument(document: vscode.TextDocument | undefined): boolean {
  return !!document && document.languageId === MARKDOWN_LANGUAGE_ID;
}

/** Returns the active Markdown document, if the active editor holds one. */
export function getActiveMarkdownDocument(): vscode.TextDocument | undefined {
  const editor = vscode.window.activeTextEditor;
  if (editor && isMarkdownDocument(editor.document)) {
    return editor.document;
  }
  return undefined;
}
