import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import type { SearchResult } from "./types";

interface RgJsonOutput {
  type: string;
  data?: RgMatchData;
}

interface RgMatchData {
  path?: { text: string };
  lines?: { text: string };
  line_number?: number;
  column?: number;
  submatches?: Array<{
    match: { text: string };
    start: number;
    end: number;
  }>;
}

export function buildRgCommand(query: string): string[] {
  const args = [
    "--json",
    "--no-heading",
    "--line-number",
    "--column",
    "-n",
    "-g",
    "!node_modules",
    "-g",
    "!.git",
    "-g",
    "!.next",
    "-g",
    "!dist",
    "-g",
    "!build",
  ];

  if (query.startsWith("regex:")) {
    const regex = query.slice(6);
    args.push("-E", regex);
  } else if (query.startsWith("fixed:")) {
    const fixed = query.slice(6);
    args.push("-F", fixed);
  } else {
    args.push(query);
  }

  return args;
}

function parseRgJsonLine(line: string): RgJsonOutput | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function buildResult(
  currentPath: string,
  data: RgMatchData,
): SearchResult | null {
  if (!data.lines || data.line_number === undefined) {
    return null;
  }
  const matchedText = data.submatches?.[0]?.match.text ?? "";
  return {
    id: `${currentPath}:${String(data.line_number)}:${String(data.column ?? 0)}`,
    label: data.lines.text.trim(),
    path: currentPath,
    lineNum: data.line_number,
    colNum: data.column ?? 0,
    lineText: data.lines.text,
    matchedText,
    startLine: data.line_number,
    endLine: data.line_number,
  };
}

export function parseRgOutput(stdout: string): SearchResult[] {
  const results: SearchResult[] = [];
  let currentPath: string | null = null;

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;

    const parsed = parseRgJsonLine(line);
    if (!parsed || !parsed.data) continue;

    if (parsed.type === "path") {
      currentPath = parsed.data?.path?.text ?? null;
      continue;
    }

    const data = parsed.data;
    if (data.path?.text !== undefined) {
      currentPath = data.path.text;
    }

    if (!currentPath) continue;
    const result = buildResult(currentPath, data);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

export async function runSearch(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
): Promise<SearchResult[]> {
  const args = buildRgCommand(query);
  const result = await pi.exec("rg", args, { cwd });

  if (result.code !== 0 && !result.stdout.trim()) {
    return [];
  }

  return parseRgOutput(result.stdout);
}

export function filterResults(
  results: SearchResult[],
  query: string,
): SearchResult[] {
  if (!query) return results;
  const q = query.toLowerCase();
  return results.filter(
    (r) =>
      r.lineText.toLowerCase().includes(q) || r.path.toLowerCase().includes(q),
  );
}

export function formatSearchResult(
  width: number,
  theme: Theme,
  result: SearchResult,
): string {
  const pathShort = result.path.replace(/^\.\//, "");
  const location = `${pathShort}:${String(result.lineNum)}`;
  return location;
}

function _truncateLine(line: string, maxLen: number): string {
  if (line.length <= maxLen) return line;
  return "…" + line.slice(-(maxLen - 1));
}

export function highlightMatch(
  text: string,
  match: string,
  theme: Theme,
): string {
  if (!match) return text;
  const lowerText = text.toLowerCase();
  const lowerMatch = match.toLowerCase();
  const idx = lowerText.indexOf(lowerMatch);

  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const matched = text.slice(idx, idx + match.length);
  const after = text.slice(idx + match.length);

  return `${before}${theme.fg("accent", theme.bold(matched))}${after}`;
}

function skipAnsiSequence(ansiText: string, pos: number): number {
  while (pos < ansiText.length && ansiText[pos] !== "m") {
    pos++;
  }
  return pos < ansiText.length ? pos + 1 : pos;
}

export function countAnsiBytes(ansiText: string, textPrefix: string): number {
  let charIndex = 0;
  let ansiIndex = 0;
  const targetLen = textPrefix.length;

  while (charIndex < targetLen && ansiIndex < ansiText.length) {
    if (ansiText[ansiIndex] === "\x1b") {
      ansiIndex = skipAnsiSequence(ansiText, ansiIndex);
    } else {
      charIndex++;
      ansiIndex++;
    }
  }

  if (
    ansiIndex < ansiText.length &&
    ansiIndex >= 2 &&
    ansiText[ansiIndex - 2] === "\x1b"
  ) {
    return skipAnsiSequence(ansiText, ansiIndex);
  }

  return ansiIndex;
}
