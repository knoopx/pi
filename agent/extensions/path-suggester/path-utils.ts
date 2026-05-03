import { execFile } from "node:child_process";

export interface CmEntry {
  path: string;
  lang: string;
  symbolsCount: number;
  symbols: string;
}

interface SymbolToken {
  name: string;
  type: string;
}

function parseSymbolTokens(symbols: string): SymbolToken[] {
  const tokens: SymbolToken[] = [];
  for (const token of symbols.split(",")) {
    let colonIdx = token.indexOf(":");
    if (colonIdx < 0 || colonIdx === 0) continue;

    let atIdx = token.indexOf("@");
    const nameEnd = atIdx > 0 ? atIdx : token.length;

    tokens.push({
      type: token.slice(0, colonIdx),
      name: token.slice(colonIdx + 1, nameEnd),
    });
  }
  return tokens;
}

function parseCmMapOutput(output: string): CmEntry[] {
  const entries: CmEntry[] = [];
  for (const line of output.split("\n")) {
    if (
      line.startsWith("[") ||
      line.includes("LANGS:") ||
      line.includes("FILES:")
    )
      continue;
    const parts = line.split("|");
    if (parts.length >= 4) {
      entries.push({
        path: parts[0],
        lang: parts[1],
        symbolsCount: parseInt(parts[2], 10),
        symbols: parts.slice(3).join("|"),
      });
    }
  }
  return entries;
}

export function buildFileList(projectDir: string): Promise<CmEntry[]> {
  return new Promise((resolve) => {
    execFile(
      "cm",
      ["map", projectDir, "--level", "3", "--format", "ai"],
      { timeout: 15_000 },
      (err: Error | null, stdout: string) => {
        if (err || !stdout.trim()) resolve([]);
        else resolve(parseCmMapOutput(stdout));
      },
    );
  });
}

const typeMap: Record<string, string> = {
  f: "function",
  m: "method",
  c: "class",
  if: "interface",
  ty: "type",
  h: "heading",
  cb: "codeblock",
};

export function buildSymbolText(entry: CmEntry): string {
  const tokens = parseSymbolTokens(entry.symbols);
  if (tokens.length === 0) return "";

  const seen = new Set<string>();
  const unique: SymbolToken[] = [];
  for (const t of tokens) {
    if (t.name === "anonymous") continue;
    const key = `${t.type}:${t.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }

  if (unique.length === 0) return "";
  const parts = unique.map((t) => `${t.name} (${typeMap[t.type] ?? t.type})`);
  return parts.join(", ").slice(0, 600);
}
