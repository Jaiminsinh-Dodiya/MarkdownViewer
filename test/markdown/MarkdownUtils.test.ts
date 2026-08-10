import * as assert from 'assert';
import { escapeHtml, isRemoteResource, slugify } from '../../src/markdown/MarkdownUtils';

suite('MarkdownUtils', () => {
  test('slugify lowercases and hyphenates heading text', () => {
    assert.strictEqual(slugify('Getting Started'), 'getting-started');
    assert.strictEqual(slugify('  Multiple   Spaces  '), 'multiple-spaces');
    assert.strictEqual(slugify('C++ & Rust!'), 'c-rust');
  });

  test('isRemoteResource identifies http/https/protocol-relative/data URIs', () => {
    assert.strictEqual(isRemoteResource('https://example.com/a.png'), true);
    assert.strictEqual(isRemoteResource('http://example.com/a.png'), true);
    assert.strictEqual(isRemoteResource('//example.com/a.png'), true);
    assert.strictEqual(isRemoteResource('data:image/png;base64,AAAA'), true);
  });

  test('isRemoteResource treats relative paths as local', () => {
    assert.strictEqual(isRemoteResource('./images/logo.png'), false);
    assert.strictEqual(isRemoteResource('images/logo.png'), false);
    assert.strictEqual(isRemoteResource('/images/logo.png'), false);
  });

  test('escapeHtml escapes the five reserved HTML characters', () => {
    assert.strictEqual(
      escapeHtml(`<a href="x">'&'</a>`),
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    );
  });
});
