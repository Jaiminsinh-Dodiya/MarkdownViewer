import * as assert from 'assert';
import { MarkdownItEngine } from '../../src/markdown/MarkdownRenderer';
import { DEFAULT_RENDER_OPTIONS } from '../../src/markdown/MarkdownTypes';

suite('MarkdownItEngine', () => {
  const engine = new MarkdownItEngine();
  const render = (source: string, overrides: Partial<typeof DEFAULT_RENDER_OPTIONS> = {}) =>
    engine.render(source, { ...DEFAULT_RENDER_OPTIONS, ...overrides });

  test('renders headings h1-h6 and extracts them', () => {
    const source = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const result = render(source);
    for (let level = 1; level <= 6; level++) {
      assert.match(result.html, new RegExp(`<h${level}[^>]*>H${level}<a[^>]*>#</a></h${level}>`));
    }
    assert.strictEqual(result.headings.length, 6);
    assert.strictEqual(result.headings[0].level, 1);
    assert.strictEqual(result.headings[0].text, 'H1');
    assert.strictEqual(result.headings[0].slug, 'h1');
  });

  test('renders paragraphs as separate <p> tags', () => {
    const result = render('First paragraph.\n\nSecond paragraph.');
    const matches = result.html.match(/<p>/g);
    assert.strictEqual(matches?.length, 2);
  });

  test('renders bold, italic, bold-italic, strikethrough, and inline code', () => {
    const result = render('**bold** *italic* ***bolditalic*** ~~strike~~ `code`');
    assert.match(result.html, /<strong>bold<\/strong>/);
    assert.match(result.html, /<em>italic<\/em>/);
    assert.match(result.html, /<em><strong>bolditalic<\/strong><\/em>/);
    assert.match(result.html, /<s>strike<\/s>/);
    assert.match(result.html, /<code>code<\/code>/);
  });

  test('renders unordered, ordered, and nested lists', () => {
    const result = render('- A\n- B\n  - Nested\n\n1. First\n2. Second');
    assert.match(result.html, /<ul>[\s\S]*<li>A<\/li>/);
    assert.match(result.html, /<li>Nested<\/li>/);
    assert.match(result.html, /<ol>[\s\S]*<li>First<\/li>/);
  });

  test('renders GitHub-style task lists as display-only checkboxes', () => {
    const result = render('- [ ] Todo\n- [x] Done');
    assert.match(result.html, /<input[^>]*disabled[^>]*type="checkbox"/);
    assert.match(result.html, /checked/);
  });

  test('renders links and marks external links for interception', () => {
    const result = render('[OpenAI](https://openai.com)');
    assert.match(result.html, /href="https:\/\/openai\.com"/);
    assert.match(result.html, /data-external-link="true"/);
  });

  test('resolves relative image paths through the provided resolver', () => {
    const result = render('![Logo](./images/logo.png)', {
      resolveResourcePath: (rawPath) =>
        `https://uuid.vscode-resource.vscode-cdn.net/resolved/${rawPath}`
    });
    assert.match(
      result.html,
      /src="https:\/\/uuid\.vscode-resource\.vscode-cdn\.net\/resolved\/\.\/images\/logo\.png"/
    );
  });

  test('does not resolve remote image URLs through the local resolver', () => {
    const result = render('![Remote](https://example.com/pic.png)', {
      resolveResourcePath: () => 'should-not-be-used'
    });
    assert.match(result.html, /src="https:\/\/example\.com\/pic\.png"/);
  });

  test('renders blockquotes including nested blockquotes', () => {
    const result = render('> Outer\n>\n> > Inner');
    assert.match(result.html, /<blockquote>[\s\S]*<blockquote>[\s\S]*Inner/);
  });

  test('renders fenced code blocks with syntax highlighting for known languages', () => {
    const result = render('```javascript\nconsole.log("hi");\n```');
    assert.match(result.html, /class="hljs-/);
    assert.strictEqual(result.warnings.length, 0);
  });

  test('falls back to plain text for unknown code languages without crashing', () => {
    const result = render('```not-a-real-language\nsome text\n```');
    assert.match(result.html, /<pre data-lang="not-a-real-language"><code/);
    assert.ok(result.warnings.some((w) => w.includes('Unknown code language')));
  });

  test('renders tables with alignment, wrapped for responsiveness', () => {
    const result = render(
      '| Left | Center | Right |\n|:-----|:------:|------:|\n| A | B | C |'
    );
    assert.match(result.html, /<div class="markdown-viewer-table-wrapper">[\s\S]*<table>/);
    assert.match(result.html, /style="text-align:center"/);
    assert.match(result.html, /style="text-align:right"/);
  });

  test('renders horizontal rules', () => {
    const result = render('above\n\n---\n\nbelow');
    assert.match(result.html, /<hr>/);
  });

  test('does not crash on malformed/unusual input', () => {
    assert.doesNotThrow(() => render('# Unterminated **bold\n```\nunterminated fence'));
  });

  test('escapes raw HTML by default when allowHtml is false', () => {
    const result = render('<script>alert(1)</script>', { allowHtml: false });
    assert.doesNotMatch(result.html, /<script>/);
  });

  test('sanitizes raw HTML even when allowHtml is true', () => {
    const result = render('<script>alert(1)</script>\n\nSafe text', {
      allowHtml: true,
      sanitizeHtml: true
    });
    assert.doesNotMatch(result.html, /<script/);
    assert.match(result.html, /Safe text/);
  });

  test('appends a jump-link permalink anchor after each heading', () => {
    const result = render('## Getting Started');
    assert.match(result.html, /<h2 id="getting-started">Getting Started<a[^>]*href="#getting-started"[^>]*>#<\/a><\/h2>/);
  });

  test('labels fenced code blocks with a friendly display name for known languages', () => {
    const result = render('```ts\nconst x = 1;\n```');
    assert.match(result.html, /<pre data-lang="TypeScript">/);
  });

  test('labels fenced code blocks with the raw identifier for unrecognized languages', () => {
    const result = render('```cobol\nDISPLAY "HI".\n```');
    assert.match(result.html, /<pre data-lang="cobol">/);
  });

  test('renders Obsidian-style callout blocks with data-callout attribute', () => {
    const result = render('> [!warning] Be careful!\n> Danger ahead');
    assert.match(result.html, /class="mv-callout"/);
    assert.match(result.html, /data-callout="warning"/);
    assert.match(result.html, /mv-callout-title/);
  });

  test('renders footnotes and footnote references', () => {
    const result = render('Here is a note[^1].\n\n[^1]: Reference detail.');
    assert.match(result.html, /class="footnote-ref"/);
    assert.match(result.html, /class="footnotes"/);
  });

  test('renders emoji shortcodes into Unicode emoji', () => {
    const result = render(':smile:');
    assert.match(result.html, /😄/);
  });

  test('renders subscript and superscript syntax', () => {
    const result = render('H~2~O and 2^10^');
    assert.match(result.html, /<sub>2<\/sub>/);
    assert.match(result.html, /<sup>10<\/sup>/);
  });

  test('extracts YAML frontmatter and renders properties card', () => {
    const result = render('---\ntitle: Hello\nauthor: Me\n---\n\n# Body');
    assert.match(result.html, /class="mv-frontmatter"/);
    assert.match(result.html, /mv-frontmatter-key">title/);
    assert.strictEqual(result.frontmatter?.trim(), 'title: Hello\nauthor: Me');
  });

  test('renders mermaid fenced blocks as <div class="mermaid">', () => {
    const result = render('```mermaid\ngraph TD;\n    A-->B;\n```');
    assert.match(result.html, /<div class="mermaid">graph TD;[\s\S]*<\/div>/);
  });

  test('stamps data-line attributes on block elements when line tagging is enabled', () => {
    const result = render('# Heading\n\nParagraph text.', { enableLineTagging: true });
    assert.match(result.html, /<h1[^>]*data-line="1"/);
    assert.match(result.html, /<p[^>]*data-line="3"/);
  });

  test('renders mark, ins, deflist, and abbr syntax extensions', () => {
    const source = '==highlight== ++inserted++\n\nTerm\n: Definition\n\n*[HTML]: HyperText';
    const result = render(source);
    assert.match(result.html, /<mark>highlight<\/mark>/);
    assert.match(result.html, /<ins>inserted<\/ins>/);
    assert.match(result.html, /<dl>[\s\S]*<dt>Term<\/dt>[\s\S]*<dd>Definition<\/dd>/);
    assert.match(result.html, /<abbr title="HyperText">HTML<\/abbr>/);
  });

  test('computes accurate document statistics', () => {
    const source = '# Sample Document\n\nThis is a sample markdown document with seven words.';
    const result = render(source);
    assert.strictEqual(result.stats.words, 10);
    assert.strictEqual(result.stats.lines, 3);
    assert.strictEqual(result.stats.readingTimeMin, 1);
  });
});
