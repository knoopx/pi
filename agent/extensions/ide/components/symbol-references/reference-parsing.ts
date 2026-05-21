import type { SymbolReferenceCommandDef, SymbolReferenceItem } from "./types";
export function makeCommandDef(
  title: string,
  command: string,
  argsFn: (target: string) => string[],
): SymbolReferenceCommandDef {
  return { titleFn: (t) => title.replace("{}", t), command, argsFn };
}
const SKIP_PREFIXES = new Set(["[", "#", "-", "("]);

function isOutputLine(line: string): boolean {
  if (!line.trim()) return false;
  if (SKIP_PREFIXES.has(line[0])) return false;
  return line.includes("|");
}

function filterOutputLines(output: string): string[] {
  return output.split("\n").filter(isOutputLine);
}
function extractExtraInfo(parts: string[]): {
  signature: string | undefined;
  callLine: number | undefined;
} {
  let signature: string | undefined;
  let callLine: number | undefined;

  for (let i = 3; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.startsWith("sig:")) signature = part.slice(4);
    else if (part.startsWith("call:")) callLine = parseInt(part.slice(5), 10);
  }

  return { signature, callLine };
}
function parseLineRange(
  lineRangeMatch: RegExpExecArray,
  headerFile: string,
): { path: string; startLine: number; endLine: number } {
  return {
    path: headerFile,
    startLine: parseInt(lineRangeMatch[1], 10),
    endLine: parseInt(lineRangeMatch[2], 10),
  };
}

function parseStartLine(locationPart: string, colonIdx: number): number {
  const parsed = parseInt(locationPart.slice(colonIdx + 1), 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}

function parseLocation(
  locationPart: string,
  headerFile: string | undefined,
): { path: string; startLine: number; endLine: number } {
  const lineRangeMatch = /^(\d+)-(\d+)$/.exec(locationPart);
  if (lineRangeMatch && headerFile) {
    return parseLineRange(lineRangeMatch, headerFile);
  }
  if (locationPart.includes(":")) {
    const colonIdx = locationPart.lastIndexOf(":");
    const path = locationPart.slice(0, colonIdx);
    const startLine = parseStartLine(locationPart, colonIdx);
    return { path, startLine, endLine: startLine };
  }
  return { path: locationPart, startLine: 1, endLine: 1 };
}
function normalizeName(name: string, path: string): string {
  if (/^\d+$/.test(name)) {
    const basename = path.split("/").pop() ?? path;
    return basename.replace(/\.[^.]+$/, "");
  }
  return name;
}
function extractHeaderFile(output: string): string | undefined {
  return /\[FILE:([^\]]+)\]/.exec(output)?.[1];
}

export function parseSymbolReferenceOutput(
  output: string,
): SymbolReferenceItem[] {
  const headerFile = extractHeaderFile(output);
  const lines = filterOutputLines(output);
  const items: SymbolReferenceItem[] = [];

  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 3) continue;
    const name = parts[0].trim();
    const type = parts[1].trim();
    const locationPart = parts[2].trim();
    const { signature, callLine } = extractExtraInfo(parts);

    if (locationPart.includes("<external>")) continue;
    const { path, startLine, endLine } = parseLocation(
      locationPart,
      headerFile,
    );
    const normalized = normalizeName(name, path);

    items.push({
      id: `${path}:${String(startLine)}`,
      label: normalized,
      name: normalized,
      type,
      path,
      startLine,
      endLine,
      signature,
      callLine,
    });
  }

  return items;
}
