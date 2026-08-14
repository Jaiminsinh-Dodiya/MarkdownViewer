import MarkdownIt from 'markdown-it';

/**
 * A markdown-it core ruler plugin that stamps `data-line="L"` attributes
 * onto all block-opening tokens that carry a `.map` line range.
 *
 * This enables precise, robust bi-directional scroll synchronization between
 * the source editor and the Webview preview.
 */
export function lineTaggingPlugin(md: MarkdownIt): void {
  md.core.ruler.after('block', 'line_tagging', (state) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Only tag block-open tokens (nesting === 1) or self-closing block tokens (nesting === 0)
      // that have source line mapping (.map)
      if (token.map && token.map.length >= 2 && (token.nesting === 1 || token.nesting === 0)) {
        // Map contains [startLine, endLine] (0-indexed line numbers)
        const startLine = token.map[0] + 1; // Convert to 1-indexed for VS Code line ranges
        token.attrSet('data-line', String(startLine));
      }
    }
  });
}
