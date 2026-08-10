/**
 * Small, pure, dependency-light helpers for the Markdown engine.
 * Kept separate from MarkdownRenderer so they can be unit tested in isolation.
 */

/**
 * Produces a GitHub-style slug from heading text, used for anchor ids.
 * Lowercases, strips characters that aren't word chars/spaces/hyphens,
 * and converts whitespace to hyphens. Not a full GitHub-compatible
 * implementation, but stable and good enough for in-document anchors.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Determines whether a path is a remote resource (http/https/data URI)
 * as opposed to a local/relative path that needs Webview URI resolution.
 */
export function isRemoteResource(path: string): boolean {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(path) || path.startsWith('data:');
}

/**
 * Returns true if a fence-block language identifier is one that
 * highlight.js is likely to recognize. This is a cheap guard used to
 * decide whether to attempt highlighting at all; the renderer must still
 * fall back gracefully if highlighting throws.
 */
export function isKnownLanguageToken(lang: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_+-]*$/.test(lang.trim());
}

/**
 * Escapes a string for safe inclusion in HTML text content.
 * Used for fallback rendering paths (e.g. plain-text code blocks)
 * where we bypass the full HTML sanitizer for performance.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
