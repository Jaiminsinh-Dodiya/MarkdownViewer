import * as path from 'path';
import * as vscode from 'vscode';

import { MarkdownEngine } from '../markdown/MarkdownEngine';
import { DEFAULT_RENDER_OPTIONS, MarkdownRenderOptions } from '../markdown/MarkdownTypes';
import { computeLocalResourceRoots, resolveWebviewResourcePath } from '../utils/UriUtils';
import { getWebviewHtml } from './WebviewContent';

interface ManagedPanel {
  panel: vscode.WebviewPanel;
  documentUri: vscode.Uri;
  hasLoadedInitialHtml: boolean;
  lastSyncFromPreviewTime: number;
}

/**
 * Connects VS Code documents to the Markdown engine and manages the
 * lifecycle of preview Webview panels.
 */
export class MarkdownPreviewProvider {
  private readonly panels = new Map<string, ManagedPanel>();
  private readonly changeDebounceTimers = new Map<string, NodeJS.Timeout>();
  private static readonly DEBOUNCE_MS = 150;
  private static readonly COOLDOWN_MS = 200;

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
      this.renderInto(existing, document);
      return;
    }

    const config = vscode.workspace.getConfiguration('markdownViewer', document.uri);
    const customStylesPath = config.get<string>('customStyles', '').trim();
    const extraRoots: vscode.Uri[] = [];

    if (customStylesPath) {
      const resolvedPath = path.isAbsolute(customStylesPath)
        ? customStylesPath
        : path.join(vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || '', customStylesPath);
      extraRoots.push(vscode.Uri.file(path.dirname(resolvedPath)));
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
          ...extraRoots,
          ...computeLocalResourceRoots(document.uri)
        ],
        retainContextWhenHidden: true
      }
    );

    const managed: ManagedPanel = {
      panel,
      documentUri: document.uri,
      hasLoadedInitialHtml: false,
      lastSyncFromPreviewTime: 0
    };

    panel.onDidDispose(() => {
      this.panels.delete(key);
      this.clearDebounce(key);
    });

    panel.webview.onDidReceiveMessage((message: { type?: string; href?: string; line?: number }) => {
      if (message?.type === 'openExternalLink' && typeof message.href === 'string') {
        this.openExternalLink(message.href);
      } else if (message?.type === 'revealLine' && typeof message.line === 'number') {
        this.handleRevealLineFromPreview(managed, message.line);
      }
    });

    this.panels.set(key, managed);
    this.renderInto(managed, document);
  }

  /** Called when editor scrolls — sends scrollToLine message to Webview if sync enabled. */
  public postScrollToLine(documentUri: vscode.Uri, line: number): void {
    const key = documentUri.toString();
    const managed = this.panels.get(key);
    if (!managed) { return; }

    const config = vscode.workspace.getConfiguration('markdownViewer', documentUri);
    if (!config.get<boolean>('scrollSync', true)) { return; }

    // Cooldown check: if preview just scrolled editor, ignore echo scroll
    if (Date.now() - managed.lastSyncFromPreviewTime < MarkdownPreviewProvider.COOLDOWN_MS) {
      return;
    }

    managed.panel.webview.postMessage({ type: 'scrollToLine', line });
  }

  /** Called on document change events; re-renders or updates matching panel debounced. */
  public onDocumentChanged(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const managed = this.panels.get(key);
    if (!managed) {
      return;
    }

    this.clearDebounce(key);
    const timer = setTimeout(() => {
      this.renderInto(managed, document);
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

  private renderInto(managed: ManagedPanel, document: vscode.TextDocument): void {
    const config = vscode.workspace.getConfiguration('markdownViewer', document.uri);
    const enableMath = config.get<boolean>('math', true);
    const enableMermaid = config.get<boolean>('mermaid', true);
    const showToc = config.get<boolean>('showToc', true);
    const showStats = config.get<boolean>('showStats', true);
    const customStylesPath = config.get<string>('customStyles', '').trim();

    let customStylesUri: vscode.Uri | undefined;
    if (customStylesPath) {
      const resolvedPath = path.isAbsolute(customStylesPath)
        ? customStylesPath
        : path.join(vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath || '', customStylesPath);
      customStylesUri = managed.panel.webview.asWebviewUri(vscode.Uri.file(resolvedPath));
    }

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
      enableLineTagging: config.get<boolean>('scrollSync', true),
      resolveResourcePath: (rawPath: string) =>
        resolveWebviewResourcePath(managed.panel.webview, document.uri, rawPath)
    };

    let rendered;
    try {
      rendered = this.engine.render(document.getText(), options);
    } catch (err) {
      console.error('Markdown Engine render error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const safeErrMsg = errMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      managed.panel.webview.html = getWebviewHtml(managed.panel.webview, this.context.extensionUri, {
        bodyHtml: `<p class="markdown-viewer-error">The Markdown preview could not be rendered. Error: ${safeErrMsg}</p>`,
        maxContentWidth: config.get<number>('maxContentWidth', 900),
        warnings: [],
        enableMath,
        enableMermaid,
        showToc,
        showStats,
        headings: []
      });
      return;
    }

    // Phase 0: If initial full HTML shell was already set, post an incremental update message!
    if (managed.hasLoadedInitialHtml) {
      managed.panel.webview.postMessage({
        type: 'update',
        html: rendered.html,
        headings: rendered.headings,
        warnings: rendered.warnings,
        frontmatter: rendered.frontmatter,
        stats: rendered.stats
      });
      return;
    }

    // First load: set full HTML shell
    managed.panel.webview.html = getWebviewHtml(managed.panel.webview, this.context.extensionUri, {
      bodyHtml: rendered.html,
      maxContentWidth: config.get<number>('maxContentWidth', 900),
      warnings: rendered.warnings,
      enableMath,
      enableMermaid,
      showToc,
      showStats,
      customStylesUri,
      headings: rendered.headings,
      stats: rendered.stats
    });
    managed.hasLoadedInitialHtml = true;
  }

  private handleRevealLineFromPreview(managed: ManagedPanel, line: number): void {
    const config = vscode.workspace.getConfiguration('markdownViewer', managed.documentUri);
    if (!config.get<boolean>('scrollSync', true)) { return; }

    managed.lastSyncFromPreviewTime = Date.now();

    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === managed.documentUri.toString()) {
        const lineIdx = Math.max(0, line - 1);
        const range = new vscode.Range(lineIdx, 0, lineIdx, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        break;
      }
    }
  }

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
