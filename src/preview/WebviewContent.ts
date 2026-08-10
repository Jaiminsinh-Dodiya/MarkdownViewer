import * as vscode from 'vscode';
import { buildContentSecurityPolicy, generateNonce } from './WebviewSecurity';

export interface WebviewContentOptions {
  bodyHtml: string;
  maxContentWidth: number;
  /** Non-fatal rendering warnings to surface subtly at the top of the preview. */
  warnings: string[];
}

/**
 * Assembles the static HTML shell that hosts rendered Markdown.
 *
 * Kept intentionally simple per spec section 25: a stylesheet, a small
 * client script whose only job is intercepting external link clicks, and
 * the rendered body. No framework, no unnecessary DOM work.
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

  const warningsHtml =
    options.warnings.length > 0
      ? `<div class="markdown-viewer-warnings">
           ${options.warnings.map((w) => `<div class="markdown-viewer-warning">${escapeForAttribute(w)}</div>`).join('')}
         </div>`
      : '';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <link href="${highlightStyleUri}" rel="stylesheet">
  <style nonce="${nonce}">
    :root { --markdown-viewer-max-width: ${options.maxContentWidth}px; }
  </style>
  <title>Markdown Preview</title>
</head>
<body>
  ${warningsHtml}
  <div class="markdown-viewer-content" id="markdown-viewer-content">
    ${options.bodyHtml}
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function escapeForAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
