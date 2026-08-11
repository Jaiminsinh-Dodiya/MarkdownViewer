import * as vscode from 'vscode';

import { MarkdownEngine } from '../markdown/MarkdownEngine';
import { DEFAULT_RENDER_OPTIONS, MarkdownRenderOptions } from '../markdown/MarkdownTypes';
import { computeLocalResourceRoots, resolveWebviewResourcePath } from '../utils/UriUtils';
import { getWebviewHtml } from './WebviewContent';

interface ManagedPanel {
  panel: vscode.WebviewPanel;
  documentUri: vscode.Uri;
}

/**
 * Connects VS Code documents to the Markdown engine and manages the
 * lifecycle of preview Webview panels.
 *
 * Responsibilities (see spec section 20/29):
 *  - Create/reveal panels, keyed by source document.
 *  - Re-render on document change (debounced) without recreating the panel.
 *  - Configure Webview options (scripts enabled, restricted resource roots).
 *  - Read extension configuration and pass it through as render options.
 *
 * This class must NOT contain Markdown parsing logic — that lives entirely
 * behind the MarkdownEngine interface.
 */
export class MarkdownPreviewProvider {
  private readonly panels = new Map<string, ManagedPanel>();
  private readonly changeDebounceTimers = new Map<string, NodeJS.Timeout>();
  private static readonly DEBOUNCE_MS = 150;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly engine: MarkdownEngine
  ) {}

  /** Opens (or reveals) a preview for the given document in the given column. */
  public openPreview(document: vscode.TextDocument, column: vscode.ViewColumn): void {
    const key = document.uri.toString();
    const existing = this.panels.get(key);

    if (existing) {
      existing.panel.reveal(column, column === vscode.ViewColumn.Beside);
      this.renderInto(existing.panel, document);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'markdownViewer.preview',
      `Preview: ${document.fileName.split(/[\\/]/).pop()}`,
      { viewColumn: column, preserveFocus: column === vscode.ViewColumn.Beside },
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'media'),
          vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'katex', 'dist'),
          ...computeLocalResourceRoots(document.uri)
        ],
        retainContextWhenHidden: true
      }
    );

    panel.onDidDispose(() => {
      this.panels.delete(key);
      this.clearDebounce(key);
    });

    panel.webview.onDidReceiveMessage((message: { type?: string; href?: string }) => {
      if (message?.type === 'openExternalLink' && typeof message.href === 'string') {
        this.openExternalLink(message.href);
      }
    });

    this.panels.set(key, { panel, documentUri: document.uri });
    this.renderInto(panel, document);
  }

  /** Called on document change events; re-renders the matching panel, if any, debounced. */
  public onDocumentChanged(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const managed = this.panels.get(key);
    if (!managed) {
      return;
    }

    this.clearDebounce(key);
    const timer = setTimeout(() => {
      this.renderInto(managed.panel, document);
    }, MarkdownPreviewProvider.DEBOUNCE_MS);
    this.changeDebounceTimers.set(key, timer);
  }

  /** True if a preview panel currently exists for this document. */
  public hasPreview(documentUri: vscode.Uri): boolean {
    return this.panels.has(documentUri.toString());
  }

  public dispose(): void {
    for (const timer of this.changeDebounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const managed of this.panels.values()) {
      managed.panel.dispose();
    }
    this.panels.clear();
    this.changeDebounceTimers.clear();
  }

  private renderInto(panel: vscode.WebviewPanel, document: vscode.TextDocument): void {
    const config = vscode.workspace.getConfiguration('markdownViewer', document.uri);
    const enableMath = config.get<boolean>('math', true);
    const enableMermaid = config.get<boolean>('mermaid', true);

    const options: MarkdownRenderOptions = {
      ...DEFAULT_RENDER_OPTIONS,
      allowHtml: config.get<boolean>('allowHtml', DEFAULT_RENDER_OPTIONS.allowHtml),
      syntaxHighlighting: config.get<boolean>(
        'syntaxHighlighting',
        DEFAULT_RENDER_OPTIONS.syntaxHighlighting
      ),
      showFrontmatter: config.get<boolean>('showFrontmatter', true),
      enableMath,
      enableMermaid,
      resolveResourcePath: (rawPath: string) =>
        resolveWebviewResourcePath(panel.webview, document.uri, rawPath)
    };

    let rendered;
    try {
      rendered = this.engine.render(document.getText(), options);
    } catch (err) {
      panel.webview.html = getWebviewHtml(panel.webview, this.context.extensionUri, {
        bodyHtml: `<p class="markdown-viewer-error">The Markdown preview could not be rendered.</p>`,
        maxContentWidth: config.get<number>('maxContentWidth', 900),
        warnings: [],
        enableMath,
        enableMermaid
      });
      return;
    }

    panel.webview.html = getWebviewHtml(panel.webview, this.context.extensionUri, {
      bodyHtml: rendered.html,
      maxContentWidth: config.get<number>('maxContentWidth', 900),
      warnings: rendered.warnings,
      enableMath,
      enableMermaid
    });
  }

  /**
   * Opens a link using VS Code's external-open mechanism rather than
   * allowing the Webview to navigate to it directly. Only http/https/mailto
   * schemes are permitted — this is the enforcement point referenced by the
   * Webview security requirements in spec section 24.
   */
  private openExternalLink(href: string): void {
    let uri: vscode.Uri;
    try {
      uri = vscode.Uri.parse(href, true);
    } catch (err) {
      return;
    }
    if (!['http', 'https', 'mailto'].includes(uri.scheme)) {
      return;
    }
    void vscode.env.openExternal(uri);
  }

  private clearDebounce(key: string): void {
    const timer = this.changeDebounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.changeDebounceTimers.delete(key);
    }
  }
}
