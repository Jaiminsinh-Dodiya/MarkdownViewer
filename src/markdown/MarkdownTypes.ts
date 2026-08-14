/**
 * Type definitions for the Markdown engine.
 *
 * This module has NO dependency on the VS Code API. It exists so the
 * rendering layer can be reused, tested, or swapped out independently
 * of the editor integration.
 */

/** Computed document statistics. */
export interface DocumentStats {
  words: number;
  chars: number;
  lines: number;
  readingTimeMin: number;
}

/**
 * Options that control how a Markdown document is rendered.
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
   */
  resolveResourcePath?: (rawPath: string) => string;
  /** Whether to show extracted frontmatter as a property block. */
  showFrontmatter: boolean;
  /** Whether to render math equations using KaTeX. */
  enableMath: boolean;
  /** Whether to render Mermaid diagrams. */
  enableMermaid: boolean;
  /** Whether to enable line tagging (data-line="L") for scroll sync. */
  enableLineTagging: boolean;
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
  /** The extracted YAML frontmatter block (if any). */
  frontmatter?: string;
  /** Computed document statistics. */
  stats: DocumentStats;
}

/** Thrown by the engine only for truly unrecoverable input. */
export class MarkdownRenderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'MarkdownRenderError';
  }
}

export const DEFAULT_RENDER_OPTIONS: MarkdownRenderOptions = {
  allowHtml: false,
  syntaxHighlighting: true,
  sanitizeHtml: true,
  showFrontmatter: true,
  enableMath: true,
  enableMermaid: true,
  enableLineTagging: true
};
