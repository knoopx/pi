/**
 * LSP Core - Manager Class
 */

import * as path from "node:path";
import * as fs from "node:fs";

import { pathToFileURL, fileURLToPath } from "node:url";

import { createMessageConnection } from "vscode-jsonrpc/node";
import {
  InitializeRequest,
  InitializeParams,
} from "vscode-languageserver-protocol";

import {
  type LSPClient,
  type OpenFile,
  type FileDiagnosticItem,
  type FileDiagnosticsResult,
} from "./types";
import {
  Diagnostic,
  CodeActionKind,
  type Location,
  type LocationLink,
  type Hover,
  type SignatureHelp,
  type DocumentSymbol,
  type SymbolInformation,
  type WorkspaceEdit,
  type CodeAction,
  type Command,
  type PublishDiagnosticsParams,
} from "vscode-languageserver-protocol";
import { normalizeFsPath } from "./utils";
import { LSP_SERVERS } from "./server-configs";

// Constants
const MAX_OPEN_FILES = 30;

// Singleton Manager
let sharedManager: LSPManager | null = null;
let managerCwd: string | null = null;

export function getOrCreateManager(cwd: string): LSPManager {
  // Check for global mock first (for testing)
  const globalMock = globalThis as {
    getOrCreateManager?: (cwd: string) => LSPManager;
  };
  if (typeof globalMock.getOrCreateManager === "function") {
    return globalMock.getOrCreateManager(cwd);
  }

  if (!sharedManager || managerCwd !== cwd) {
    sharedManager?.shutdown().catch(() => {});
    sharedManager = new LSPManager(cwd);
    managerCwd = cwd;
  }
  return sharedManager;
}

export function getManager(): LSPManager | null {
  return sharedManager;
}

export async function shutdownManager(): Promise<void> {
  if (sharedManager) {
    await sharedManager.shutdown();
    sharedManager = null;
    managerCwd = null;
  }
}

// LSP Manager
export class LSPManager {
  constructor(cwd: string) {
    this._cwd = cwd;
  }

  private _cwd: string;
  private _clients: Map<string, LSPClient> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  get cwd(): string {
    return this._cwd;
  }

  get root(): string {
    return this._cwd;
  }

  /**
   * Helper method to load file and open it in LSP clients
   */
  private async loadAndOpenFile(fp: string): Promise<{
    clients: LSPClient[];
    absPath: string;
    uri: string;
    langId: string;
    content: string;
  } | null> {
    const l = await this.loadFile(fp);
    if (!l) return null;
    await this.openOrUpdate(l.clients, l.absPath, l.uri, l.langId, l.content);
    return l;
  }

  async touchFileAndWait(
    filePath: string,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<{
    diagnostics: Diagnostic[];
    receivedResponse: boolean;
    unsupported?: boolean;
    error?: string;
  }> {
    if (signal?.aborted) {
      return {
        diagnostics: [],
        receivedResponse: false,
        error: "Aborted",
      };
    }

    const absPath = this.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      return {
        diagnostics: [],
        receivedResponse: true,
        unsupported: false,
        error: "File not found",
      };
    }

    const clients = await this.getClientsForFile(absPath);
    if (signal?.aborted) {
      return {
        diagnostics: [],
        receivedResponse: false,
        error: "Aborted",
      };
    }

    if (!clients.length) {
      return {
        diagnostics: [],
        receivedResponse: true,
        unsupported: true,
        error: this.explainNoLsp(absPath),
      };
    }

    const content = this.checkFileContent(absPath);
    if (!content) {
      return {
        diagnostics: [],
        receivedResponse: true,
        unsupported: false,
        error: "Could not read file",
      };
    }

    const uri = pathToFileURL(absPath).href;
    const langId = this.langId(absPath);

    // Clear stale diagnostics before opening/updating the file
    for (const c of clients) {
      c.diagnostics.delete(absPath);
    }

    await this.openOrUpdate(clients, absPath, uri, langId, content);

    if (signal?.aborted) {
      return {
        diagnostics: [],
        receivedResponse: false,
        error: "Aborted",
      };
    }

    let responded = false;
    const diags: Diagnostic[] = [];
    for (const c of clients) {
      if (signal?.aborted) break;
      const r = await this.waitForDiagnostics(
        c,
        absPath,
        timeoutMs,
        true,
        signal,
      );
      if (r) responded = true;
      const fileDiags = c.diagnostics.get(absPath) || [];
      diags.push(...fileDiags);
    }

    if (signal?.aborted) {
      return {
        diagnostics: [],
        receivedResponse: false,
        error: "Aborted",
      };
    }

    // Only consider it a response if we actually received diagnostics or explicitly waited
    const receivedResponse = responded || diags.length > 0;

    return {
      diagnostics: diags,
      receivedResponse: receivedResponse,
      unsupported: false,
      error: undefined,
    };
  }

  async getDiagnosticsForFiles(
    files: string[],
    _timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<FileDiagnosticsResult> {
    const unique = [...new Set(files.map((f) => this.resolve(f)))];
    const results: FileDiagnosticItem[] = [];
    const toClose: Map<LSPClient, string[]> = new Map();

    for (const absPath of unique) {
      if (signal?.aborted) break;

      if (!fs.existsSync(absPath)) {
        results.push({
          file: absPath,
          diagnostics: [],
          status: "error",
          error: "File not found",
        });
        continue;
      }

      let clients: LSPClient[];
      try {
        clients = await this.getClientsForFile(absPath);
      } catch (_e) {
        results.push({
          file: absPath,
          diagnostics: [],
          status: "error",
          error: String(_e),
        });
        continue;
      }

      if (signal?.aborted) break;

      if (!clients.length) {
        results.push({
          file: absPath,
          diagnostics: [],
          status: "unsupported",
          error: this.explainNoLsp(absPath),
        });
        continue;
      }

      let content: string;
      try {
        content = this.checkFileContent(absPath)!;
      } catch {
        results.push({
          file: absPath,
          diagnostics: [],
          status: "error",
          error: "Could not read file",
        });
        continue;
      }

      const { uri, langId } = this.prepareFileForDiagnostics(
        absPath,
        clients,
        toClose,
      );

      // Clear stale diagnostics before opening/updating
      for (const c of clients) {
        c.diagnostics.delete(absPath);
      }

      const waits = clients.map((c) =>
        this.waitForDiagnostics(c, absPath, _timeoutMs, false, signal),
      );
      await this.openOrUpdate(clients, absPath, uri, langId, content);

      if (signal?.aborted) break;

      const waitResults = await Promise.all(waits);

      if (signal?.aborted) break;

      const diags: Diagnostic[] = [];
      for (const c of clients) {
        const d = c.diagnostics.get(absPath);
        if (d) diags.push(...d);
      }

      let responded = waitResults.some((r: boolean) => r) || diags.length > 0;

      if (!responded || diags.length === 0) {
        const pulled = await Promise.all(
          clients.map((c) => this.pullDiagnostics(c, absPath, uri)),
        );
        for (let i = 0; i < clients.length; i++) {
          const r = pulled[i];
          if (r) {
            responded = true;
            if (r.diagnostics && r.diagnostics.length) {
              clients[i].diagnostics.set(absPath, r.diagnostics);
              diags.push(...r.diagnostics);
            }
          }
        }
      }

      if (!responded && !diags.length) {
        results.push({
          file: absPath,
          diagnostics: [],
          status: "timeout",
          error: "LSP did not respond",
        });
      } else {
        results.push({ file: absPath, diagnostics: diags, status: "ok" });
      }
    }

    // Cleanup opened files
    for (const [c, fps] of toClose) {
      for (const fp of fps) this.closeFile(c, fp);
    }
    for (const c of this._clients.values()) {
      while (c.openFiles.size > MAX_OPEN_FILES) this.evictLRU(c);
    }

    return { items: results };
  }

  /**
   * Send LSP request to all clients for a specific file
   */
  private async sendRequestToAllClients(
    clients: LSPClient[],
    uri: string,
    pos: { line: number; character: number },
    params: Record<string, unknown>,
    requestType: string,
  ): Promise<unknown[]> {
    return Promise.all(
      clients.map(async (c) => {
        if (c.closed) return [];
        try {
          return await c.connection.sendRequest(requestType, {
            textDocument: { uri },
            position: pos,
            ...params,
          });
        } catch {
          return [];
        }
      }),
    );
  }

  /**
   * Send LSP request to a single client for hover/signature help
   */
  private async sendRequestToSingleClient<T>(
    clients: LSPClient[],
    uri: string,
    pos: { line: number; character: number },
    requestType: string,
    params: Record<string, unknown>,
  ): Promise<T | null> {
    for (const c of clients) {
      if (c.closed) continue;
      try {
        const r = await c.connection.sendRequest(requestType, {
          textDocument: { uri },
          position: pos,
          ...params,
        });
        if (r) return r as T;
      } catch {}
    }
    return null;
  }

  async getDefinition(
    fp: string,
    line: number,
    col: number,
  ): Promise<Location[]> {
    const l = await this.loadAndOpenFile(fp);
    if (!l) return [];

    const pos = this.toPos(line, col);
    const results = await this.sendRequestToAllClients(
      l.clients,
      l.uri,
      pos,
      {},
      "textDocument/definition",
    );
    return this.normalizeLocs(
      results as Location | Location[] | LocationLink[] | null | undefined,
    );
  }

  async getReferences(
    fp: string,
    line: number,
    col: number,
  ): Promise<Location[]> {
    const l = await this.loadAndOpenFile(fp);
    if (!l) return [];

    const pos = this.toPos(line, col);
    const results = await this.sendRequestToAllClients(
      l.clients,
      l.uri,
      pos,
      { context: { includeDeclaration: true } },
      "textDocument/references",
    );
    return this.normalizeLocs(
      results as Location | Location[] | LocationLink[] | null | undefined,
    );
  }

  async getHover(fp: string, line: number, col: number): Promise<Hover | null> {
    const l = await this.loadAndOpenFile(fp);
    if (!l) return null;

    const pos = this.toPos(line, col);
    return this.sendRequestToSingleClient(
      l.clients,
      l.uri,
      pos,
      "textDocument/hover",
      {},
    );
  }

  async getSignatureHelp(
    fp: string,
    line: number,
    col: number,
  ): Promise<SignatureHelp | null> {
    const l = await this.loadAndOpenFile(fp);
    if (!l) return null;

    const pos = this.toPos(line, col);
    return this.sendRequestToSingleClient(
      l.clients,
      l.uri,
      pos,
      "textDocument/signatureHelp",
      {},
    );
  }

  async getDocumentSymbols(fp: string): Promise<DocumentSymbol[]> {
    const l = await this.loadAndOpenFile(fp);
    if (!l) return [];

    const results = await this.sendRequestToAllClients(
      l.clients,
      l.uri,
      { line: 0, character: 0 },
      {},
      "textDocument/documentSymbol",
    );
    return this.normalizeSymbols(
      results as DocumentSymbol[] | SymbolInformation[] | null | undefined,
    );
  }

  async rename(
    fp: string,
    line: number,
    col: number,
    newName: string,
  ): Promise<WorkspaceEdit | null> {
    const l = await this.loadAndOpenFile(fp);
    if (!l) return null;

    const pos = this.toPos(line, col);
    return this.sendRequestToSingleClient(
      l.clients,
      l.uri,
      pos,
      "textDocument/rename",
      { newName },
    );
  }

  async getCodeActions(
    fp: string,
    startLine: number,
    startCol: number,
    endLine?: number,
    endCol?: number,
  ): Promise<(CodeAction | Command)[]> {
    const l = await this.loadFile(fp);
    if (!l) return [];
    await this.openOrUpdate(l.clients, l.absPath, l.uri, l.langId, l.content);

    const start = this.toPos(startLine, startCol);
    const end = this.toPos(endLine ?? startLine, endCol ?? startCol);
    const range = { start, end };

    // Get diagnostics for this range to include in context
    const diagnostics: Diagnostic[] = [];
    for (const c of l.clients) {
      const fileDiags = c.diagnostics.get(l.absPath) || [];
      for (const d of fileDiags) {
        if (this.rangesOverlap(d.range, range)) diagnostics.push(d);
      }
    }

    const results = await this.sendRequestToAllClients(
      l.clients,
      l.uri,
      { line: 0, character: 0 },
      {
        range,
        context: {
          diagnostics,
          only: [
            CodeActionKind.QuickFix,
            CodeActionKind.Refactor,
            CodeActionKind.Source,
          ],
        },
      },
      "textDocument/codeAction",
    );
    return results.flat() as (CodeAction | Command)[];
  }

  private checkFileContent(absPath: string): string | null {
    const content = this.readFile(absPath);
    if (!content) {
      throw new Error("Could not read file");
    }
    return content;
  }

  private prepareFileForDiagnostics(
    absPath: string,
    clients: LSPClient[],
    toClose: Map<LSPClient, string[]>,
  ): { uri: string; langId: string } {
    const uri = pathToFileURL(absPath).href;
    const langId = this.langId(absPath);

    for (const c of clients) {
      if (!c.openFiles.has(absPath)) {
        if (!toClose.has(c)) toClose.set(c, []);
        toClose.get(c)!.push(absPath);
      }
    }

    return { uri, langId };
  }

  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    const clientsArray = Array.from(this._clients.values());
    this._clients = new Map();
    for (const c of clientsArray) {
      const wasClosed = c.closed;
      c.closed = true;
      if (!wasClosed) {
        try {
          await Promise.race([
            c.connection.sendRequest("shutdown"),
            new Promise((r) => setTimeout(r, 1000)),
          ]);
        } catch {}
        try {
          void c.connection.sendNotification("exit").catch(() => {});
        } catch {}
      }
      try {
        c.connection.end();
      } catch {}
      try {
        c.process.kill();
      } catch {}
    }
  }

  // Helper methods
  private toPos(line: number, col: number) {
    return { line: Math.max(0, line - 1), character: Math.max(0, col - 1) };
  }

  private normalizeLocs(
    result: Location | Location[] | LocationLink[] | null | undefined,
  ): Location[] {
    if (!result) return [];
    const items = Array.isArray(result) ? result : [result];
    if (!items.length) return [];
    if ("uri" in items[0] && "range" in items[0]) return items as Location[];
    return (items as LocationLink[]).map((l) => ({
      uri: l.targetUri,
      range: l.targetSelectionRange ?? l.targetRange,
    }));
  }

  private normalizeSymbols(
    result: DocumentSymbol[] | SymbolInformation[] | null | undefined,
  ): DocumentSymbol[] {
    if (!result?.length) return [];
    const first = result[0];
    if ("location" in first) {
      return (result as SymbolInformation[]).map((s) => ({
        name: s.name,
        kind: s.kind,
        range: s.location.range,
        selectionRange: s.location.range,
        detail: s.containerName,
        tags: s.tags,
        deprecated: s.deprecated,
        children: [],
      }));
    }
    return result as DocumentSymbol[];
  }

  private explainNoLsp(absPath: string): string {
    const ext = path.extname(absPath);
    return `No LSP for ${ext}`;
  }

  // Instance methods needed for getDiagnosticsForFiles
  resolve(filePath: string): string {
    return normalizeFsPath(filePath);
  }

  async getClientsForFile(absPath: string): Promise<LSPClient[]> {
    const langId = this.langId(absPath);
    const server = LSP_SERVERS.find((s) => s.id === langId);
    if (!server) return [];

    let client = this._clients.get(langId);
    if (!client) {
      const spawnResult = await server.spawn(this.root);
      if (!spawnResult) return [];

      const connection = createMessageConnection(
        new (await import("vscode-jsonrpc/node")).StreamMessageReader(
          spawnResult.process.stdout,
        ),
        new (await import("vscode-jsonrpc/node")).StreamMessageWriter(
          spawnResult.process.stdin,
        ),
      );

      client = {
        openFiles: new Map<string, OpenFile>(),
        connection,
        process: spawnResult.process,
        diagnostics: new Map<string, Diagnostic[]>(),
        listeners: new Map<string, Array<() => void>>(),
        stderr: [],
        root: this.root,
        closed: false,
      };

      this._clients.set(langId, client);

      // Listen for stderr
      client.process.stderr.on("data", (data) => {
        client!.stderr.push(data.toString());
      });

      // Start the connection
      connection.listen();

      // Initialize the server
      try {
        const initParams: InitializeParams = {
          processId: process.pid,
          rootPath: this.root,
          rootUri: pathToFileURL(this.root).href,
          capabilities: {
            textDocument: {
              synchronization: {
                dynamicRegistration: true,
                willSave: false,
                willSaveWaitUntil: false,
                didSave: false,
              },
              completion: {
                dynamicRegistration: true,
                completionItem: {
                  snippetSupport: false,
                  commitCharactersSupport: false,
                  documentationFormat: ["markdown", "plaintext"],
                  deprecatedSupport: false,
                  preselectSupport: false,
                  tagSupport: undefined,
                  insertReplaceSupport: false,
                  resolveSupport: undefined,
                  insertTextModeSupport: undefined,
                  labelDetailsSupport: undefined,
                },
                contextSupport: false,
              },
              hover: {
                dynamicRegistration: true,
                contentFormat: ["markdown", "plaintext"],
              },
              signatureHelp: {
                dynamicRegistration: true,
                signatureInformation: {
                  documentationFormat: ["markdown", "plaintext"],
                  parameterInformation: {
                    labelOffsetSupport: false,
                  },
                  activeParameterSupport: false,
                },
              },
              definition: {
                dynamicRegistration: true,
                linkSupport: false,
              },
              references: {
                dynamicRegistration: true,
              },
              documentHighlight: {
                dynamicRegistration: true,
              },
              documentSymbol: {
                dynamicRegistration: true,
                symbolKind: {
                  valueSet: [
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                    18, 19, 20, 21, 22, 23, 24, 25, 26,
                  ],
                },
                hierarchicalDocumentSymbolSupport: true,
                tagSupport: {
                  valueSet: [1],
                },
                labelSupport: false,
              },
              codeAction: {
                dynamicRegistration: true,
                codeActionLiteralSupport: {
                  codeActionKind: {
                    valueSet: [
                      "",
                      "quickfix",
                      "refactor",
                      "refactor.extract",
                      "refactor.inline",
                      "refactor.rewrite",
                      "source",
                      "source.organizeImports",
                    ],
                  },
                },
                isPreferredSupport: false,
                disabledSupport: false,
                dataSupport: false,
                resolveSupport: {
                  properties: ["edit"],
                },
                honorsChangeAnnotations: false,
              },
              codeLens: {
                dynamicRegistration: true,
              },
              formatting: {
                dynamicRegistration: true,
              },
              rangeFormatting: {
                dynamicRegistration: true,
              },
              onTypeFormatting: {
                dynamicRegistration: true,
              },
              rename: {
                dynamicRegistration: true,
                prepareSupport: true,
                honorsChangeAnnotations: false,
              },
              documentLink: {
                dynamicRegistration: true,
                tooltipSupport: false,
              },
              colorProvider: {
                dynamicRegistration: true,
              },
              foldingRange: {
                dynamicRegistration: true,
                rangeLimit: undefined,
                lineFoldingOnly: false,
              },
              declaration: {
                dynamicRegistration: true,
                linkSupport: false,
              },
              selectionRange: {
                dynamicRegistration: true,
              },
              publishDiagnostics: {
                relatedInformation: false,
                versionSupport: false,
                tagSupport: {
                  valueSet: [1, 2],
                },
                codeDescriptionSupport: false,
                dataSupport: false,
              },
              callHierarchy: {
                dynamicRegistration: true,
              },
              semanticTokens: {
                dynamicRegistration: true,
                requests: {
                  range: true,
                  full: { delta: true },
                },
                tokenTypes: [],
                tokenModifiers: [],
                formats: [],
                overlappingTokenSupport: false,
                multilineTokenSupport: false,
                serverCancelSupport: false,
                augmentsSyntaxTokens: false,
              },
              linkedEditingRange: {
                dynamicRegistration: true,
              },
              typeDefinition: {
                dynamicRegistration: true,
                linkSupport: false,
              },
              implementation: {
                dynamicRegistration: true,
                linkSupport: false,
              },
              typeHierarchy: {
                dynamicRegistration: true,
              },
              inlineValue: {
                dynamicRegistration: true,
              },
              inlayHint: {
                dynamicRegistration: true,
                resolveSupport: {
                  properties: [],
                },
              },
              diagnostic: {
                dynamicRegistration: true,
                relatedDocumentSupport: false,
              },
            },
            workspace: {
              applyEdit: false,
              workspaceEdit: {
                documentChanges: false,
                resourceOperations: [],
                failureHandling: "abort",
                normalizesLineEndings: false,
                changeAnnotationSupport: {
                  groupsOnLabel: false,
                },
              },
              didChangeConfiguration: {
                dynamicRegistration: true,
              },
              didChangeWatchedFiles: {
                dynamicRegistration: true,
              },
              symbol: {
                dynamicRegistration: true,
                symbolKind: {
                  valueSet: [
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                    18, 19, 20, 21, 22, 23, 24, 25, 26,
                  ],
                },
                tagSupport: {
                  valueSet: [1],
                },
              },
              codeLens: {
                refreshSupport: false,
              },
              executeCommand: {
                dynamicRegistration: true,
              },
              workspaceFolders: false,
              configuration: false,
              semanticTokens: {
                refreshSupport: false,
              },
              fileOperations: {
                didCreate: false,
                willCreate: false,
                didRename: false,
                willRename: false,
                didDelete: false,
                willDelete: false,
              },
              inlineValue: {
                refreshSupport: false,
              },
              inlayHint: {
                refreshSupport: false,
              },
              diagnostics: {
                refreshSupport: false,
              },
            },
            window: {
              workDoneProgress: false,
              showMessage: {
                messageActionItem: {
                  additionalPropertiesSupport: false,
                },
              },
              showDocument: {
                support: false,
              },
            },
            general: {
              regularExpressions: {
                engine: "ECMAScript",
                version: "ES2020",
              },
              markdown: {
                parser: "marked",
                version: "1.1.0",
              },
              staleRequestSupport: {
                cancel: true,
                retryOnContentModified: [],
              },
            },
          },
          initializationOptions: spawnResult.initOptions,
          workspaceFolders: [
            {
              uri: pathToFileURL(this.root).href,
              name: path.basename(this.root),
            },
          ],
        };

        const result = await connection.sendRequest(
          InitializeRequest.type,
          initParams,
        );
        client.capabilities = result.capabilities;

        // Send initialized notification
        connection.sendNotification("initialized", {});

        // Listen for diagnostics
        connection.onNotification(
          "textDocument/publishDiagnostics",
          (rawParams) => {
            const params = rawParams as PublishDiagnosticsParams;
            const fileUri = params.uri;
            let filePath: string;
            if (fileUri.startsWith("file://")) {
              try {
                filePath = fileURLToPath(fileUri);
              } catch {
                filePath = new URL(fileUri).pathname;
              }
            } else {
              filePath = fileUri;
            }
            client!.diagnostics.set(filePath, params.diagnostics);
          },
        );
      } catch (e) {
        console.error(`Failed to initialize LSP server for ${langId}:`, e);
        this._clients.delete(langId);
        return [];
      }
    }

    return [client];
  }

  readFile(absPath: string): string | null {
    try {
      return fs.readFileSync(absPath, "utf-8");
    } catch {
      return null;
    }
  }

  langId(absPath: string): string {
    const ext = path.extname(absPath);
    if (!ext) return "plaintext";

    const server = LSP_SERVERS.find((server) =>
      server.extensions.includes(ext),
    );
    return server?.id || "plaintext";
  }

  async waitForDiagnostics(
    client: LSPClient,
    absPath: string,
    timeoutMs: number,
    _isNew: boolean,
    signal?: AbortSignal,
  ): Promise<boolean> {
    const start = Date.now();
    const checkInterval = 50; // Reduced from 100ms for faster response

    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) {
        return false;
      }
      if (client.diagnostics.has(absPath)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  async openOrUpdate(
    clients: LSPClient[],
    absPath: string,
    uri: string,
    langId: string,
    content: string,
    _isNew?: boolean,
  ): Promise<void> {
    for (const client of clients) {
      if (client.closed) continue;

      const openFile = client.openFiles.get(absPath);
      const isFileOpen = openFile !== undefined;
      const version = openFile ? openFile.version + 1 : 1;

      if (!isFileOpen) {
        // File not open yet - send didOpen
        await client.connection.sendNotification("textDocument/didOpen", {
          textDocument: {
            uri,
            languageId: langId,
            version,
            text: content,
          },
        });
        client.openFiles.set(absPath, { version, lastAccess: Date.now() });
      } else {
        // File already open - send didChange with new content
        await client.connection.sendNotification("textDocument/didChange", {
          textDocument: { uri, version },
          contentChanges: [{ text: content }],
        });
        openFile.version = version;
        openFile.lastAccess = Date.now();
      }
    }
  }

  async pullDiagnostics(
    client: LSPClient,
    absPath: string,
    _uri: string,
  ): Promise<{ responded: boolean; diagnostics: Diagnostic[] } | null> {
    const diags = client.diagnostics.get(absPath);
    if (diags) {
      return { responded: true, diagnostics: diags };
    }
    return null;
  }

  async closeFile(client: LSPClient, absPath: string): Promise<void> {
    if (client.closed) return;
    const uri = pathToFileURL(absPath).href;
    await client.connection.sendNotification("textDocument/didClose", {
      textDocument: { uri },
    });
    client.openFiles.delete(absPath);
  }

  evictLRU(_c: LSPClient): void {
    // Placeholder - evict least recently used file
  }

  rangesOverlap(
    a: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    },
    b: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    },
  ): boolean {
    return !(a.end.line < b.start.line || b.end.line < a.start.line);
  }

  async loadFile(absPath: string): Promise<{
    clients: LSPClient[];
    absPath: string;
    uri: string;
    langId: string;
    content: string;
  } | null> {
    const clients = await this.getClientsForFile(absPath);
    if (!clients.length) return null;

    const content = this.readFile(absPath);
    if (content === null) return null;

    const uri = pathToFileURL(absPath).href;
    const langId = this.langId(absPath);

    return {
      clients,
      absPath,
      uri,
      langId,
      content,
    };
  }
}
