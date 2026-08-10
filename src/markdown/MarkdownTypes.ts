/**
 * Type definitions for the Markdown engine.
 *
 * This module has NO dependency on the VS Code API. It exists so the
 * rendering layer can be reused, tested, or swapped out independently
 * of the editor integration.
 */

/**
 * Options that control how a Markdown document is rendered.
 * These are intentionally coarse-grained for V0.1 — enough to support
 * the current feature set without over-specifying behavior that future
 * rendering modes (GitHub-flavored Markdown, math, Mermaid, etc.) would
 * need to redefine anyway.
 */
export interface MarkdownRenderOptions {
  /** Whether raw inline/block HTML in the source should be preserved (after sanitization). */
  allowHtml: boolean;
  /** Whether fenced code blocks should be syntax-highlighted. */
  syntaxHighlighting: boolean;
  /** Whether the resulting HTML should be run through a sanitizer before use. */
  sanitizeHtml: boolean;
  /**
   * Resolves a relative resource path (e.g. an image path found in the Markdown
   * source) to a URI string that is safe to place in the rendered HTML.
   * Supplied by the caller (the preview layer) because only it knows about
   * workspace roots and Webview URI conversion — the engine must not know
   * about the filesystem or VS Code URIs.
   */
  resolveResourcePath?: (rawPath: string) => string;
}

/** A single heading extracted from the rendered document. */
export interface MarkdownHeading {
  level: number;
  text: string;
  slug: string;
  line: number;
}

/** The result of rendering a Markdown source string. */
export interface RenderedMarkdown {
  html: string;
  headings: MarkdownHeading[];
  /** Non-fatal problems encountered while rendering (e.g. unknown code language). */
  warnings: string[];
}

/** Thrown by the engine only for truly unrecoverable input; the engine should
 *  prefer degrading gracefully (see MarkdownUtils) over throwing. */
export class MarkdownRenderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'MarkdownRenderError';
  }
}

export const DEFAULT_RENDER_OPTIONS: MarkdownRenderOptions = {
  allowHtml: false,
  syntaxHighlighting: true,
  sanitizeHtml: true
};
