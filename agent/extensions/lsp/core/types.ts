/**
 * LSP Core - Type Definitions
 */

import { type ChildProcessWithoutNullStreams } from "node:child_process";
import { type Diagnostic } from "vscode-languageserver-protocol";
import { type MessageConnection } from "vscode-jsonrpc";

/**
 * LSP Server Configuration
 */
export interface LSPServerConfig {
  id: string;
  extensions: string[];
  findRoot: (file: string, cwd: string) => string | undefined;
  spawn: (root: string) => Promise<
    | {
        process: ChildProcessWithoutNullStreams;
        initOptions?: Record<string, unknown>;
      }
    | undefined
  >;
}

/**
 * Open File State
 */
export interface OpenFile {
  version: number;
  lastAccess: number;
}

/**
 * LSP Client
 */
export interface LSPClient {
  connection: MessageConnection;
  process: ChildProcessWithoutNullStreams;
  diagnostics: Map<string, Diagnostic[]>;
  openFiles: Map<string, OpenFile>;
  listeners: Map<string, Array<() => void>>;
  stderr: string[];
  capabilities?: unknown;
  root: string;
  closed: boolean;
}

/**
 * File Diagnostic Result
 */
export interface FileDiagnosticItem {
  file: string;
  diagnostics: Diagnostic[];
  status: "ok" | "timeout" | "error" | "unsupported";
  error?: string;
}

export interface FileDiagnosticsResult {
  items: FileDiagnosticItem[];
}
