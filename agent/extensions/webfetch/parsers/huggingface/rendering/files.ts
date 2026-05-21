import type { HFPath, HFTreeEntry } from "../types";
import { BASE } from "../http";

function formatSize(bytes: number): string {
  const gb = bytes / 1_073_741_824;
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(0)}MB`;
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function hasAnyDigit(value: string): boolean {
  for (const char of value) {
    if (char >= "0" && char <= "9") return true;
  }
  return false;
}

function isQuantFormat(c: string): boolean {
  return isQFormat(c) || isFloatFormat(c) || isMxfpFormat(c) || isUdFormat(c);
}

function isQFormat(c: string): boolean {
  return (c.startsWith("IQ") || c.startsWith("Q")) && hasAnyDigit(c);
}

function isFloatFormat(c: string): boolean {
  return c === "BF16" || c === "F16" || c === "F32";
}

function isMxfpFormat(c: string): boolean {
  return c.startsWith("MXFP");
}

function isUdFormat(c: string): boolean {
  return c.startsWith("UD") && hasAnyDigit(c);
}

function stripGgufExtension(file: string): string {
  return file.endsWith(".gguf") ? file.slice(0, -5) : file;
}

function guessQuantFormat(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  const base = stripGgufExtension(file);
  const chunks = base
    .split("-")
    .flatMap((chunk) => chunk.split("."))
    .map((chunk) => chunk.toUpperCase());

  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    const c = chunks[i];
    if (!c) continue;
    if (isQuantFormat(c)) return c;
  }
  return "UNKNOWN";
}

function isGgufFile(entry: HFTreeEntry): boolean {
  return entry.type === "file" && entry.path.endsWith(".gguf");
}

function resolveEntrySize(entry: HFTreeEntry): number {
  return (entry.lfs as { size?: number } | undefined)?.size ?? entry.size ?? 0;
}

function renderGgufFiles(
  parts: string[],
  parsed: HFPath,
  tree: HFTreeEntry[],
): void {
  const ggufFiles = tree.filter(isGgufFile);
  if (ggufFiles.length === 0) return;
  parts.push("");
  parts.push(`## Quant files (${ggufFiles.length})`);
  for (const f of ggufFiles) {
    const size = resolveEntrySize(f);
    const format = guessQuantFormat(f.path);
    parts.push(
      `- ${format} — [${f.path}](${BASE}/${parsed.owner}/${parsed.name}/blob/main/${encodeURIComponent(f.path)}) (${formatSize(size)})`,
    );
  }
}

function isWeightFile(entry: HFTreeEntry): boolean {
  const weightExts = [".safetensors", ".bin", ".pt", ".onnx"];
  return (
    entry.type === "file" && weightExts.some((ext) => entry.path.endsWith(ext))
  );
}

function renderWeightFiles(
  parts: string[],
  parsed: HFPath,
  tree: HFTreeEntry[],
): void {
  const weights = tree
    .filter(isWeightFile)
    .sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
  if (weights.length === 0) return;
  parts.push("");
  const totalSize = weights.reduce((s, f) => s + (f.size ?? 0), 0);
  parts.push(
    `## Model weights (${weights.length} files, ${formatSize(totalSize)} total)`,
  );
  for (const w of weights) {
    const size = resolveEntrySize(w);
    parts.push(
      `- [${w.path}](${BASE}/${parsed.owner}/${parsed.name}/blob/main/${encodeURIComponent(w.path)}) (${formatSize(size)})`,
    );
  }
}

export function renderFileListSection(
  parts: string[],
  parsed: HFPath,
  tree: HFTreeEntry[],
  isGguf: boolean,
): void {
  if (isGguf) {
    renderGgufFiles(parts, parsed, tree);
  } else {
    renderWeightFiles(parts, parsed, tree);
  }
}
