import { MarkdownRenderOptions, RenderedMarkdown } from './MarkdownTypes';

/**
 * Abstraction over "turn Markdown source into rendered HTML".
 *
 * The preview layer talks to this interface only — never to markdown-it,
 * highlight.js, or any specific parser directly. That keeps the door open
 * for future rendering modes (GitHub-flavored Markdown, CommonMark strict
 * mode, Mermaid, math, etc.) to be introduced as alternate implementations
 * or configuration of this same contract, without touching VS Code code.
 */
export interface MarkdownEngine {
  render(source: string, options: MarkdownRenderOptions): RenderedMarkdown;
}
