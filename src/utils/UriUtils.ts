import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Resolves a raw, Markdown-source-relative resource path (e.g. an image
 * `src`) into a URI string the given Webview is permitted to load.
 *
 * This is the ONLY place in the extension that should know about the
 * relationship between "a path written in a Markdown file" and "a URI a
 * Webview can actually load". The Markdown engine never sees VS Code URIs.
 */
export function resolveWebviewResourcePath(
  webview: vscode.Webview,
  documentUri: vscode.Uri,
  rawPath: string
): string {
  try {
    const documentDir = path.dirname(documentUri.fsPath);
    // Strip any query/hash fragment before touching the filesystem path,
    // then re-append it so anchors like `image.png#fragment` still work.
    const [cleanPath, ...rest] = rawPath.split(/([?#].*)/);
    const suffix = rest.join('');

    const absolutePath = path.isAbsolute(cleanPath)
      ? cleanPath
      : path.join(documentDir, cleanPath);

    const resourceUri = vscode.Uri.file(absolutePath);
    const webviewUri = webview.asWebviewUri(resourceUri);
    return `${webviewUri.toString()}${suffix}`;
  } catch (err) {
    // If resolution fails for any reason, fall back to the raw path rather
    // than throwing — the image will simply appear broken, which the CSS
    // handles gracefully (see media/preview.css).
    return rawPath;
  }
}

/**
 * Computes the set of local roots a Webview should be allowed to load
 * resources from: the document's own directory, and the workspace folder
 * that contains it (if any). Kept narrow deliberately — see spec section 23.
 */
export function computeLocalResourceRoots(documentUri: vscode.Uri): vscode.Uri[] {
  const roots: vscode.Uri[] = [];
  const documentDir = vscode.Uri.file(path.dirname(documentUri.fsPath));
  roots.push(documentDir);

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  if (workspaceFolder) {
    roots.push(workspaceFolder.uri);
  }

  return roots;
}
