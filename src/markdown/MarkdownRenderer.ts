import MarkdownIt = require('markdown-it');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const taskLists = require('markdown-it-task-lists');
import { calloutPlugin } from './CalloutPlugin';
import { lineTaggingPlugin } from './LineTaggingPlugin';

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
  DocumentStats,
  MarkdownHeading,
  MarkdownRenderOptions,
  RenderedMarkdown
} from './MarkdownTypes';
import { escapeHtml, isRemoteResource, slugify } from './MarkdownUtils';

// A single shared JSDOM window backs DOMPurify.
const purifyWindow = new JSDOM('').window;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DOMPurify = createDOMPurify(purifyWindow as unknown as any);

/**
 * Default implementation of MarkdownEngine, built on markdown-it.
 */
export class MarkdownItEngine implements MarkdownEngine {
  render(source: string, options: MarkdownRenderOptions): RenderedMarkdown {
    const warnings: string[] = [];
    const headings: MarkdownHeading[] = [];
    const stats = this.computeStats(source);

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
          // Diagram / special languages handled by dedicated fence renderers — skip silently.
          const DIAGRAM_LANGS = new Set(['mermaid', 'math', 'latex', 'katex']);
          if (DIAGRAM_LANGS.has(trimmedLang.toLowerCase())) {
            return escapeHtml(code);
          }
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
      return {
        html: `<p class="markdown-viewer-error">Failed to initialize the Markdown renderer.</p>`,
        headings: [],
        warnings: ['Renderer initialization failed.'],
        stats
      };
    }

    md.use(taskLists, { enabled: false, label: true, labelAfter: true });
    md.use(calloutPlugin);
    
    if (options.enableLineTagging) {
      md.use(lineTaggingPlugin);
    }
    
    const footnote = require('markdown-it-footnote');
    md.use(footnote);
    
    const sub = require('markdown-it-sub');
    md.use(sub);
    
    const sup = require('markdown-it-sup');
    md.use(sup);
    
    const emoji = require('markdown-it-emoji');
    md.use(emoji.full);

    const mark = require('markdown-it-mark');
    md.use(mark);

    const ins = require('markdown-it-ins');
    md.use(ins);

    const deflist = require('markdown-it-deflist');
    md.use(deflist);

    const abbr = require('markdown-it-abbr');
    md.use(abbr);
    
    let extractedFrontmatter: string | undefined;
    const frontMatter = require('markdown-it-front-matter');
    md.use(frontMatter, (fm: string) => { extractedFrontmatter = fm; });
    
    if (options.enableMath) {
      const mk = require('@traptitech/markdown-it-katex');
      md.use(mk, { throwOnError: false, errorColor: '#cc0000' });
    }

    this.configureHeadingCapture(md, headings);
    this.configureImageResolution(md, options);
    this.configureExternalLinks(md);
    this.configureResponsiveTables(md);
    this.configureCodeLanguageLabels(md);
    
    if (options.enableMermaid) {
      const defaultFence = md.renderer.rules.fence || ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
      md.renderer.rules.fence = (tokens, idx, opts, _env, self) => {
        const token = tokens[idx];
        const info = token.info ? String(token.info).trim() : '';
        if (info === 'mermaid') {
          // Do NOT escape — mermaid.js must receive the raw diagram source.
          return `<div class="mermaid">${token.content}</div>`;
        }
        return defaultFence(tokens, idx, opts, _env, self);
      };
    }

    let html: string;
    try {
      html = md.render(source);
    } catch (err) {
      warnings.push('The document could not be fully parsed; showing raw text as a fallback.');
      html = `<pre class="markdown-viewer-fallback">${escapeHtml(source)}</pre>`;
    }

    if (options.sanitizeHtml) {
      try {
        html = DOMPurify.sanitize(html, {
          ADD_TAGS: [
            // Callout container divs and SVG icons
            'svg', 'path', 'circle', 'line', 'rect', 'polyline', 'polygon',
            'ellipse', 'g', 'defs', 'use', 'symbol',
            // KaTeX / MathML tags
            'math', 'mi', 'mn', 'mo', 'ms', 'mspace', 'mtext', 'menclose',
            'merror', 'mfenced', 'mfrac', 'mglyph', 'mlabeledtr', 'mmultiscripts',
            'mover', 'mpadded', 'mphantom', 'mroot', 'mrow', 'msqrt', 'mstyle',
            'msub', 'msubsup', 'msup', 'mtable', 'mtd', 'mtr', 'munder',
            'munderover', 'semantics', 'annotation', 'annotation-xml'
          ],
          ADD_ATTR: [
            'target', 'rel', 'checked', 'disabled',
            'data-callout', 'data-line', 'data-external-link',
            // SVG presentation attributes
            'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
            'stroke-linejoin', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r',
            'rx', 'ry', 'x', 'y', 'width', 'height', 'xmlns',
            'points', 'd',
            // KaTeX attributes
            'aria-hidden', 'mathvariant', 'mathcolor', 'mathbackground', 
            'mathsize', 'display'
          ],
          FORBID_ATTR: [],
          ALLOW_UNKNOWN_PROTOCOLS: false
        });
      } catch (err) {
        warnings.push('HTML sanitization failed; falling back to escaped plain text.');
        html = `<pre class="markdown-viewer-fallback">${escapeHtml(source)}</pre>`;
      }
    }

    if (options.showFrontmatter && extractedFrontmatter) {
      const lines = extractedFrontmatter.split('\n');
      let fmHtml = '<div class="mv-frontmatter"><div class="mv-frontmatter-title">Properties</div><div class="mv-frontmatter-content">';
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = escapeHtml(line.slice(0, colonIndex).trim());
          const value = escapeHtml(line.slice(colonIndex + 1).trim());
          fmHtml += `<div class="mv-frontmatter-row"><span class="mv-frontmatter-key">${key}</span><span class="mv-frontmatter-value">${value}</span></div>`;
        }
      }
      fmHtml += '</div></div>';
      html = fmHtml + html;
    }

    return { html, headings, warnings, frontmatter: extractedFrontmatter, stats };
  }

  private computeStats(source: string): DocumentStats {
    const chars = source.length;
    const lines = source.split('\n').length;
    // Simple robust word count: split by whitespace, filter out non-word tokens
    const wordsMatch = source.match(/[\w'-]+/g);
    const words = wordsMatch ? wordsMatch.length : 0;
    const readingTimeMin = Math.max(1, Math.ceil(words / 200));

    return { words, chars, lines, readingTimeMin };
  }

  private configureHeadingCapture(md: MarkdownIt, headings: MarkdownHeading[]): void {
    const defaultOpen: RenderRule =
      md.renderer.rules.heading_open ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
    const defaultClose: RenderRule =
      md.renderer.rules.heading_close ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.heading_open = (tokens, idx, opts, env, self): string => {
      const token = tokens[idx];
      const level = parseInt(token.tag.replace(/^h/i, ''), 10);
      const inlineToken = tokens[idx + 1];
      const text = inlineToken ? inlineToken.content : '';
      const slug = slugify(text);
      const line = token.map ? token.map[0] + 1 : 1;

      headings.push({ level, text, slug, line });
      token.attrSet('id', slug);

      return defaultOpen(tokens, idx, opts, env, self);
    };

    md.renderer.rules.heading_close = (tokens, idx, opts, env, self): string => {
      const openToken = tokens[idx - 2];
      const slug = openToken?.attrGet('id');
      const anchor = slug
        ? `<a class="markdown-viewer-permalink" href="#${slug}" aria-label="Permalink to ${escapeHtml(slug)}">#</a>`
        : '';
      return `${anchor}${defaultClose(tokens, idx, opts, env, self)}`;
    };
  }

  private configureImageResolution(md: MarkdownIt, options: MarkdownRenderOptions): void {
    const defaultImage: RenderRule =
      md.renderer.rules.image ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.image = (tokens, idx, opts, env, self): string => {
      const token = tokens[idx];
      const srcAttrIndex = token.attrIndex('src');
      if (srcAttrIndex >= 0 && token.attrs) {
        const rawPath = token.attrs[srcAttrIndex][1];
        if (!isRemoteResource(rawPath) && options.resolveResourcePath) {
          token.attrs[srcAttrIndex][1] = options.resolveResourcePath(rawPath);
        }
      }
      token.attrSet('loading', 'lazy');
      return defaultImage(tokens, idx, opts, env, self);
    };
  }

  private configureExternalLinks(md: MarkdownIt): void {
    const defaultOpen: RenderRule =
      md.renderer.rules.link_open ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.link_open = (tokens, idx, opts, env, self): string => {
      const token = tokens[idx];
      const href = token.attrGet('href') || '';
      if (isRemoteResource(href) || href.startsWith('mailto:')) {
        token.attrSet('data-external-link', 'true');
        token.attrSet('rel', 'noopener noreferrer');
      }
      return defaultOpen(tokens, idx, opts, env, self);
    };
  }

  private configureResponsiveTables(md: MarkdownIt): void {
    const defaultOpen: RenderRule =
      md.renderer.rules.table_open ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
    const defaultClose: RenderRule =
      md.renderer.rules.table_close ||
      ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

    md.renderer.rules.table_open = (tokens, idx, opts, env, self): string =>
      `<div class="table-wrapper">${defaultOpen(tokens, idx, opts, env, self)}`;
    md.renderer.rules.table_close = (tokens, idx, opts, env, self): string =>
      `${defaultClose(tokens, idx, opts, env, self)}</div>`;
  }

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
      return rendered.replace('<pre>', `<pre data-lang="${escapeHtml(label)}">`);
    };
  }
}

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
