import MarkdownIt = require('markdown-it');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const taskLists = require('markdown-it-task-lists');

type RenderRule = (
  tokens: MarkdownIt.Token[],
  idx: number,
  options: MarkdownIt.Options,
  env: unknown,
  self: MarkdownIt.Renderer
) => string;
import hljs from 'highlight.js';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

import { MarkdownEngine } from './MarkdownEngine';
import {
  MarkdownHeading,
  MarkdownRenderOptions,
  RenderedMarkdown
} from './MarkdownTypes';
import { escapeHtml, isRemoteResource, slugify } from './MarkdownUtils';

// A single shared JSDOM window backs DOMPurify. This is process-local
// scratch space, not a browsing context — nothing is ever navigated or
// loaded into it. Isolated from the VS Code Webview entirely.
const purifyWindow = new JSDOM('').window;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DOMPurify = createDOMPurify(purifyWindow as unknown as any);

/**
 * Default implementation of MarkdownEngine, built on markdown-it.
 *
 * This class owns all parser/highlighter-specific behavior. Nothing here
 * knows about VS Code, Webviews, or the filesystem — resource path
 * resolution is delegated to the caller via
 * MarkdownRenderOptions.resolveResourcePath.
 */
export class MarkdownItEngine implements MarkdownEngine {
  render(source: string, options: MarkdownRenderOptions): RenderedMarkdown {
    const warnings: string[] = [];
    const headings: MarkdownHeading[] = [];

    let md: MarkdownIt;
    try {
      md = new MarkdownIt({
        html: options.allowHtml,
        linkify: true,
        typographer: true,
        breaks: false,
        highlight: (code: string, lang: string): string => {
          if (!options.syntaxHighlighting) {
            return escapeHtml(code);
          }
          const trimmedLang = (lang || '').trim();
          if (trimmedLang && hljs.getLanguage(trimmedLang)) {
            try {
              return hljs.highlight(code, { language: trimmedLang, ignoreIllegals: true }).value;
            } catch (err) {
              warnings.push(`Failed to highlight code block with language "${trimmedLang}"; showing plain text.`);
              return escapeHtml(code);
            }
          }
          if (trimmedLang) {
            warnings.push(`Unknown code language "${trimmedLang}"; showing plain text.`);
          }
          return escapeHtml(code);
        }
      });
    } catch (err) {
      // markdown-it construction failing would be a genuinely unrecoverable
      // environment problem (not bad user input), so this is the one place
      // we surface it loudly rather than degrading.
      return {
        html: `<p class="markdown-viewer-error">Failed to initialize the Markdown renderer.</p>`,
        headings: [],
        warnings: ['Renderer initialization failed.']
      };
    }

    // `enabled: false` (the default) is what we want here: it renders
    // checkboxes with the `disabled` attribute, matching the spec
    // requirement that task-list checkboxes are display-only in V0.1.
    md.use(taskLists, { enabled: false, label: true, labelAfter: true });

    this.configureHeadingCapture(md, headings);
    this.configureImageResolution(md, options);
    this.configureExternalLinks(md);
    this.configureResponsiveTables(md);
    this.configureCodeLanguageLabels(md);

    let html: string;
    try {
      html = md.render(source);
    } catch (err) {
      // Malformed input should never crash the extension — fall back to a
      // plain, escaped rendering of the raw source instead.
      warnings.push('The document could not be fully parsed; showing raw text as a fallback.');
      html = `<pre class="markdown-viewer-fallback">${escapeHtml(source)}</pre>`;
    }

    if (options.sanitizeHtml) {
      try {
        html = DOMPurify.sanitize(html, {
          ADD_ATTR: ['target', 'rel', 'checked', 'disabled'],
          ALLOW_UNKNOWN_PROTOCOLS: false
        });
      } catch (err) {
        warnings.push('HTML sanitization failed; falling back to escaped plain text.');
        html = `<pre class="markdown-viewer-fallback">${escapeHtml(source)}</pre>`;
      }
    }

    return { html, headings, warnings };
  }

  /**
   * Captures rendered heading text/levels/slugs, stamps ids onto heading
   * tokens, and appends a hover-revealed permalink anchor (a quiet,
   * Bear/Typora-style touch — invisible until the reader's cursor is near it).
   */
  private configureHeadingCapture(md: MarkdownIt, headings: MarkdownHeading[]): void {
    const defaultOpen: RenderRule =
      md.renderer.rules.heading_open ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
    const defaultClose: RenderRule =
      md.renderer.rules.heading_close ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.heading_open = (tokens, idx, opts, env, self): string => {
      const token = tokens[idx];
      const level = Number(token.tag.replace('h', '')) || 1;
      const inlineToken = tokens[idx + 1];
      const text = inlineToken ? inlineToken.content : '';
      const slug = slugify(text);
      token.attrSet('id', slug);
      headings.push({ level, text, slug, line: token.map ? token.map[0] : -1 });
      return defaultOpen(tokens, idx, opts, env, self);
    };

    md.renderer.rules.heading_close = (tokens, idx, opts, env, self): string => {
      const openToken = tokens[idx - 2]; // heading_open, inline, heading_close
      const slug = openToken?.attrGet('id') ?? '';
      const anchor = slug
        ? `<a class="mv-heading-anchor" href="#${slug}" aria-label="Link to this section">#</a>`
        : '';
      return anchor + defaultClose(tokens, idx, opts, env, self);
    };
  }

  /** Rewrites image src attributes through the caller-supplied resource resolver. */
  private configureImageResolution(md: MarkdownIt, options: MarkdownRenderOptions): void {
    const defaultRender: RenderRule =
      md.renderer.rules.image ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.image = (tokens, idx, opts, env, self): string => {
      const token = tokens[idx];
      const srcIndex = token.attrIndex('src');
      if (srcIndex >= 0 && options.resolveResourcePath) {
        const raw = token.attrs![srcIndex][1];
        if (!isRemoteResource(raw)) {
          token.attrs![srcIndex][1] = options.resolveResourcePath(raw);
        }
      }
      token.attrSet('loading', 'lazy');
      return defaultRender(tokens, idx, opts, env, self);
    };
  }

  /**
   * Marks external links so the Webview's minimal client script can
   * intercept clicks and hand them to VS Code's "open external" mechanism
   * instead of allowing in-Webview navigation.
   */
  private configureExternalLinks(md: MarkdownIt): void {
    const defaultRender: RenderRule =
      md.renderer.rules.link_open ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.link_open = (tokens, idx, opts, env, self): string => {
      const token = tokens[idx];
      const hrefIndex = token.attrIndex('href');
      const href = hrefIndex >= 0 ? token.attrs![hrefIndex][1] : '';
      if (isRemoteResource(href) || href.startsWith('mailto:')) {
        token.attrSet('data-external-link', 'true');
        token.attrSet('rel', 'noopener noreferrer');
      }
      return defaultRender(tokens, idx, opts, env, self);
    };
  }

  /** Wraps rendered tables in a scrollable container so wide tables can't break the page layout. */
  private configureResponsiveTables(md: MarkdownIt): void {
    const defaultOpen: RenderRule =
      md.renderer.rules.table_open ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
    const defaultClose: RenderRule =
      md.renderer.rules.table_close ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.table_open = (tokens, idx, opts, env, self): string =>
      `<div class="markdown-viewer-table-wrapper">${defaultOpen(tokens, idx, opts, env, self)}`;
    md.renderer.rules.table_close = (tokens, idx, opts, env, self): string =>
      `${defaultClose(tokens, idx, opts, env, self)}</div>`;
  }

  /**
   * Stamps the fenced code block's language onto the `<pre>` element as a
   * data attribute, so the stylesheet can display it as a small label
   * (e.g. "TypeScript", "Bash") the way editors like Bear or Typora do.
   * Purely presentational — falls back silently if the language is unknown.
   */
  private configureCodeLanguageLabels(md: MarkdownIt): void {
    const defaultFence: RenderRule =
      md.renderer.rules.fence ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.fence = (tokens, idx, opts, env, self): string => {
      const token = tokens[idx];
      const rendered = defaultFence(tokens, idx, opts, env, self);
      const langName = (token.info || '').trim().split(/\s+/)[0];
      if (!langName) {
        return rendered;
      }
      const label = CODE_LANGUAGE_LABELS[langName.toLowerCase()] ?? langName;
      // The default fence renderer always opens with a bare `<pre>` (no
      // attributes) unless something upstream has already customized it;
      // this rule runs first among fence customizations, so that holds.
      return rendered.replace('<pre>', `<pre data-lang="${escapeHtml(label)}">`);
    };
  }
}

/** Friendlier display names for common language identifiers, used by the code-block label. */
const CODE_LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  ruby: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  cpp: 'C++',
  'c++': 'C++',
  c: 'C',
  cs: 'C#',
  csharp: 'C#',
  java: 'Java',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  swift: 'Swift',
  php: 'PHP',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  shell: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  md: 'Markdown',
  markdown: 'Markdown',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL'
};
