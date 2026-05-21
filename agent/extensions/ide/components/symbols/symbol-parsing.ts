import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SymbolInfo, SymbolTypeFilter } from "./types";
function buildQueryArgs(
  query: string,
  typeFilter?: SymbolTypeFilter,
): string[] {
  const args = ["query", query, "--format", "ai"];
  if (typeFilter && typeFilter !== "all") args.push("--type", typeFilter);
  return args;
}
function safeParseInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
function normalizeString(value: string, fallback: string): string {
  return value ?? fallback;
}

function buildSymbolInfo(
  name: string,
  type: string,
  path: string,
  startLine: number,
  endLine: number,
): SymbolInfo {
  const safeName = normalizeString(name, "");
  const safePath = normalizeString(path, "");
  return {
    id: `${safePath}:${String(startLine)}`,
    label: safeName,
    name: safeName,
    type: normalizeString(type, "f"),
    path: safePath,
    startLine,
    endLine,
  };
}

function parseSymbolLine(line: string): SymbolInfo | null {
  const match = /^(.+)\|([a-z_]+)\|(\.[^|]+)\|(\d+-\d+)/.exec(line);
  if (!match) return null;
  const [, name, type, path, lineRange] = match;
  const [startStr, endStr] = lineRange.split("-");
  const startLine = safeParseInt(startStr, 1);
  const endLine = safeParseInt(endStr, startLine);

  return buildSymbolInfo(name, type, path, startLine, endLine);
}
function isValidSymbol(s: SymbolInfo): boolean {
  const isTestFile = (path: string) =>
    /\.(test|spec)\.[jt]sx?$/.test(path) || path.includes("__tests__");
  return !!s.name && !!s.path && !isTestFile(s.path);
}
export async function querySymbols(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
  typeFilter?: SymbolTypeFilter,
): Promise<SymbolInfo[]> {
  const args = buildQueryArgs(query, typeFilter);
  const result = await pi.exec("cm", args, { cwd });
  if (result.code !== 0) return [];
  const lines = result.stdout
    .split("\n")
    .filter((line) => line.includes("|") && !line.startsWith("["));

  return lines
    .map(parseSymbolLine)
    .filter((s): s is SymbolInfo => s !== null && isValidSymbol(s));
}
