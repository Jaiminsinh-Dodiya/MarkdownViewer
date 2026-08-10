import * as assert from 'assert';
import * as vscode from 'vscode';
import { computeLocalResourceRoots, resolveWebviewResourcePath } from '../../src/utils/UriUtils';

/** Minimal stand-in for vscode.Webview sufficient for asWebviewUri calls. */
function createFakeWebview(): vscode.Webview {
  return {
    asWebviewUri: (uri: vscode.Uri) =>
      vscode.Uri.parse(`https://file+.vscode-resource.vscode-cdn.net${uri.path}`),
    cspSource: 'vscode-resource:'
    // Other Webview members are unused by resolveWebviewResourcePath.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

suite('UriUtils', () => {
  test('resolves a relative image path next to the Markdown document', () => {
    const webview = createFakeWebview();
    const documentUri = vscode.Uri.file('/workspace/project/README.md');

    const resolved = resolveWebviewResourcePath(webview, documentUri, './images/logo.png');

    assert.match(resolved, /vscode-cdn\.net\/workspace\/project\/images\/logo\.png$/);
  });

  test('preserves query/hash fragments through resolution', () => {
    const webview = createFakeWebview();
    const documentUri = vscode.Uri.file('/workspace/project/README.md');

    const resolved = resolveWebviewResourcePath(webview, documentUri, './logo.png?v=2');

    assert.match(resolved, /logo\.png\?v=2$/);
  });

  test('falls back to the raw path if resolution throws', () => {
    const throwingWebview = {
      asWebviewUri: () => {
        throw new Error('boom');
      },
      cspSource: 'vscode-resource:'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as vscode.Webview;
    const documentUri = vscode.Uri.file('/workspace/project/README.md');

    const resolved = resolveWebviewResourcePath(throwingWebview, documentUri, './logo.png');

    assert.strictEqual(resolved, './logo.png');
  });

  test('computeLocalResourceRoots includes the document directory', () => {
    const documentUri = vscode.Uri.file('/workspace/project/docs/README.md');
    const roots = computeLocalResourceRoots(documentUri);

    assert.ok(roots.some((r) => r.fsPath === '/workspace/project/docs'));
  });
});
