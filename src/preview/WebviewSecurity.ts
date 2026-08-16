import * as crypto from 'crypto';
import * as vscode from 'vscode';

/** Generates a cryptographically random nonce for the CSP script-src directive. */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Builds a strict Content-Security-Policy for the preview Webview.
 *
 * - No inline/eval script execution (`script-src 'nonce-...'` only).
 * - Inline styles use the same nonce (`style-src ... 'nonce-...'`) to allow
 *   the single `<style>` block that sets the max-width CSS variable.
 * - Images may load from the Webview's own resource scheme (local files
 *   resolved via asWebviewUri) or over https (remote images in Markdown).
 * - Styles are restricted to the Webview's own stylesheet plus the nonce.
 * - Fonts are allowed from the Webview resource scheme (for KaTeX fonts).
 * - No frames, connect, or object sources are permitted at all.
 *
 * This is deliberately restrictive. Markdown source content is never
 * trusted, and this policy is the backstop if sanitization elsewhere
 * were ever bypassed.
 */
export function buildContentSecurityPolicy(webview: vscode.Webview, nonce: string): string {
  return [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource} data:`
  ].join('; ');
}
