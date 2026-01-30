/**
 * LSP Client Wrapper
 *
 * Handles communication with LSP language servers
 */

import {
  MessageConnection,
  type Diagnostic,
} from "vscode-languageserver-protocol";
import { ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * LSP Client State
 */
export interface LSPClientState {
  connection: MessageConnection | null;
  process: ChildProcessWithoutNullStreams;
  diagnostics: Map<string, Diagnostic[]>;
  openFiles: Map<string, OpenFile>;
  listeners: Map<string, Array<() => void>>;
  capabilities?: unknown;
  root: string;
  closed: boolean;
}

/**
 * Open File Interface
 */
export interface OpenFile {
  version: number;
  lastAccess: number;
}

/**
 * Convert URI to file path
 */
export function uriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return fileURLToPath(uri);
  }
  return uri;
}

/**
 * Initialize LSP Client
 */
export async function initializeLSPClient(
  proc: ChildProcessWithoutNullStreams,
  root: string,
  initOptions?: Record<string, unknown>,
): Promise<LSPClientState> {
  const sendRequest = async (
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> => {
    const message =
      JSON.stringify({
        jsonrpc: "2.0",
        id: Math.random().toString(36).substr(2, 9),
        method,
        params,
      }) + "\n";

    proc.stdin.write(message);

    return new Promise((resolve, reject) => {
      const handler = (data: Buffer) => {
        const chunk = data.toString();
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.id || response.error) {
                proc.stdout.off("data", handler);
                if (response.error) {
                  reject(response.error);
                } else {
                  resolve(response.result);
                }
              }
            } catch {
              // Ignore parse errors for partial messages
            }
          }
        }
      };
      proc.stdout.on("data", handler);
    });
  };

  const sendNotification = async (
    method: string,
    params: Record<string, unknown>,
  ): Promise<void> => {
    const message =
      JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
      }) + "\n";
    proc.stdin.write(message);
  };

  const sendResponse = (_id: string, _result: unknown): void => {
    const message =
      JSON.stringify({
        jsonrpc: "2.0",
        id: _id,
        result: _result,
      }) + "\n";
    proc.stdin.write(message);
  };

  const sendError = (_id: string, error: unknown): void => {
    const message =
      JSON.stringify({
        jsonrpc: "2.0",
        id: _id,
        error,
      }) + "\n";
    proc.stdin.write(message);
  };

  const handleStderr = (_data: Buffer): void => {
    // Stderr handling - could log or buffer if needed
  };

  // Initialize connection
  const clientState: LSPClientState = {
    connection: {
      sendRequest,
      sendNotification,
      sendResponse,
      sendError,
      capabilities: {},
      trace: "off",
      onClose: () => {},
      onError: () => {},
      onNotification: () => {},
    } as unknown,
    process: proc,
    diagnostics: new Map<string, Diagnostic[]>(),
    openFiles: new Map<string, OpenFile>(),
    listeners: new Map<string, Array<() => void>>(),
    root,
    closed: false,
  };

  // Initialize client
  const initResult = await sendRequest("initialize", {
    processId: proc.pid,
    rootUri: `file://${root}`,
    capabilities: {},
    initializationOptions: initOptions || {},
  });

  if (
    initResult &&
    typeof initResult === "object" &&
    "capabilities" in initResult
  ) {
    clientState.capabilities = (initResult as unknown).capabilities;
  }

  // Send initialized notification
  await sendNotification("initialized", {});

  // Start listening for messages
  proc.stdout.on("data", async (data: Buffer) => {
    const chunk = data.toString();
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        const { method, params, id } = message;

        if (method === "textDocument/publishDiagnostics") {
          const { uri, diagnostics } = params;
          const absPath = uriToPath(uri);
          clientState.diagnostics.set(absPath, diagnostics);
          clientState.listeners.get(absPath)?.forEach((cb) => cb());
        } else if (method === "window/showMessage") {
          console.log("LSP Message:", params.message);
        } else if (method === "window/showMessageRequest") {
          console.log("LSP Request:", params.message);
        } else if (method === "window/logMessage") {
          console.log("LSP Log:", params.message);
        } else if (id && typeof id === "string") {
          // Response message - already handled by sendRequest
        }
      } catch {
        // Could be a partial message or error
      }
    }
  });

  proc.stderr.on("data", handleStderr);

  // Monitor process exit
  proc.on("exit", (code) => {
    if (code !== 0) {
      console.error(`LSP process exited with code ${code}`);
    }
    if (!clientState.closed) {
      clientState.closed = true;
    }
  });

  proc.on("error", (err) => {
    console.error("LSP process error:", err);
  });

  return clientState;
}

/**
 * Send text document did open notification
 */
export async function didOpen(
  connection: MessageConnection,
  filePath: string,
  languageId: string,
  content: string,
): Promise<void> {
  await connection.sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: `file://${filePath}`,
      languageId,
      version: 1,
    },
    content,
  });
}

/**
 * Send text document did change notification
 */
export async function didChange(
  connection: MessageConnection,
  filePath: string,
  version: number,
  content: string,
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  },
  text?: string,
): Promise<void> {
  await connection.sendNotification("textDocument/didChange", {
    textDocument: {
      uri: `file://${filePath}`,
      version,
    },
    contentChanges: range && text ? [{ range, text }] : [{ text: content }],
  });
}

/**
 * Send text document did close notification
 */
export async function didClose(
  connection: MessageConnection,
  filePath: string,
): Promise<void> {
  await connection.sendNotification("textDocument/didClose", {
    textDocument: {
      uri: `file://${filePath}`,
    },
  });
}

/**
 * Send text document save notification
 */
export async function didSave(
  connection: MessageConnection,
  filePath: string,
): Promise<void> {
  await connection.sendNotification("textDocument/didSave", {
    textDocument: {
      uri: `file://${filePath}`,
    },
  });
}

/**
 * Send text document diagnostics request
 */
export async function diagnostics(
  connection: MessageConnection,
  filePath: string,
): Promise<Diagnostic[]> {
  try {
    const result = await connection.sendRequest("textDocument/diagnostic", {
      textDocument: {
        uri: `file://${filePath}`,
      },
    });
    return (result as Diagnostic[]) || [];
  } catch {
    return [];
  }
}

/**
 * Send text document hover request
 */
export async function hover(
  connection: MessageConnection,
  filePath: string,
  line: number,
  character: number,
): Promise<unknown> {
  try {
    const result = await connection.sendRequest("textDocument/hover", {
      textDocument: {
        uri: `file://${filePath}`,
      },
      position: { line, character },
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Send text document signature help request
 */
export async function signatureHelp(
  connection: MessageConnection,
  filePath: string,
  line: number,
  character: number,
): Promise<unknown> {
  try {
    const result = await connection.sendRequest("textDocument/signatureHelp", {
      textDocument: {
        uri: `file://${filePath}`,
      },
      position: { line, character },
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Send text document definition request
 */
export async function definition(
  connection: MessageConnection,
  filePath: string,
  line: number,
  character: number,
): Promise<unknown> {
  try {
    const result = await connection.sendRequest("textDocument/definition", {
      textDocument: {
        uri: `file://${filePath}`,
      },
      position: { line, character },
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Send text document references request
 */
export async function references(
  connection: MessageConnection,
  filePath: string,
  line: number,
  character: number,
  includeDeclaration = true,
): Promise<unknown> {
  try {
    const result = await connection.sendRequest("textDocument/references", {
      textDocument: {
        uri: `file://${filePath}`,
      },
      position: { line, character },
      context: {
        includeDeclaration,
      },
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Send text document document symbols request
 */
export async function documentSymbols(
  connection: MessageConnection,
  filePath: string,
): Promise<unknown> {
  try {
    const result = await connection.sendRequest("textDocument/documentSymbol", {
      textDocument: {
        uri: `file://${filePath}`,
      },
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Send text document rename request
 */
export async function rename(
  connection: MessageConnection,
  filePath: string,
  line: number,
  character: number,
  newName: string,
): Promise<unknown> {
  try {
    const result = await connection.sendRequest("textDocument/rename", {
      textDocument: {
        uri: `file://${filePath}`,
      },
      position: { line, character },
      newName,
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Send text document code action request
 */
export async function codeAction(
  connection: MessageConnection,
  filePath: string,
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
): Promise<unknown> {
  try {
    const result = await connection.sendRequest("textDocument/codeAction", {
      textDocument: {
        uri: `file://${filePath}`,
      },
      range: {
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
      },
      context: {
        diagnostics: [],
      },
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Shutdown LSP client
 */
export async function shutdown(connection: MessageConnection): Promise<void> {
  try {
    await connection.sendRequest("shutdown", {});
    await connection.sendNotification("exit", {});
  } catch {
    // Ignore errors
  }
}
