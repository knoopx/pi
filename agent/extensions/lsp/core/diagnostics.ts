/**
 * LSP Core - Diagnostic Utilities
 */

import { Diagnostic } from "vscode-languageserver-protocol";
import { fileURLToPath } from "url";

export type SeverityFilter = "all" | "error" | "warning" | "info" | "hint";

type SymbolItem = {
  name?: string;
  selectionRange?: { start: { line: number; character: number } };
  range?: { start: { line: number; character: number } };
  children?: SymbolItem[];
};

interface LspManager {
  getDocumentSymbols(file: string): Promise<unknown[]>;
}

/**
 * Format diagnostic for display
 */
export function formatDiagnostic(d: Diagnostic): string {
  const sev = ["", "ERROR", "WARN", "INFO", "HINT"][d.severity ?? 2];
  return `${sev} [${d.range.start.line + 1}:${d.range.start.character + 1}] ${d.message}`;
}

/**
 * Filter diagnostics by severity
 */
export function filterDiagnosticsBySeverity(
  diags: Diagnostic[],
  filter: SeverityFilter,
): Diagnostic[] {
  if (filter === "all") return diags;
  const max = { error: 1, warning: 2, info: 3, hint: 4 }[filter];
  return diags.filter((d) => (d.severity || 1) <= max);
}

/**
 * Convert URI to file path
 */
export function uriToPath(uri: string): string {
  if (uri.startsWith("file://"))
    try {
      const path = fileURLToPath(uri);
      // On Unix systems, fileURLToPath may return /path or path without leading slash
      // We want /path format to match the expected output
      if (path.startsWith("/") && !uri.startsWith("file:///")) {
        // Keep the leading slash
        return path;
      }
      // On Windows or other systems, just return as-is
      return path;
    } catch {}
  return uri;
}

/**
 * Find symbol position in document symbols
 */
export function findSymbolPosition(
  symbols: SymbolItem[],
  query: string,
): { line: number; character: number } | null {
  const q = query.toLowerCase();
  let exact: { line: number; character: number } | null = null;
  let partial: { line: number; character: number } | null = null;

  const visit = (items: SymbolItem[]) => {
    for (const sym of items) {
      const name = String(sym?.name ?? "").toLowerCase();
      const pos = sym?.selectionRange?.start ?? sym?.range?.start;
      if (
        pos &&
        typeof pos.line === "number" &&
        typeof pos.character === "number"
      ) {
        if (!exact && name === q) exact = pos;
        if (!partial && name.includes(q)) partial = pos;
      }
      if (sym?.children?.length) visit(sym.children);
    }
  };
  visit(symbols);
  return exact ?? partial;
}

/**
 * Resolve position by searching for a symbol
 */
export async function resolvePosition(
  manager: LspManager,
  file: string,
  query: string,
): Promise<{ line: number; character: number } | null> {
  const symbols = await manager.getDocumentSymbols(file);
  const pos = findSymbolPosition(symbols as SymbolItem[], query);
  if (pos) {
    return {
      line: pos.line,
      character: pos.character,
    };
  }
  return null;
}
