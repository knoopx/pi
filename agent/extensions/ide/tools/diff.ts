import { codeToANSI } from "@shikijs/cli";
import { bundledThemes, type BundledLanguage, type BundledTheme } from "shiki";
import { createLRUCache } from "../lib/lru-cache";
import { lang } from "../lib/language";
import {
  parseGitDiff,
  type DiffHunk,
  type DiffHunkBlock,
  type DiffLine,
} from "../lib/diff-parsing";

interface DiffConfig {
  addBg: string | null;
  removeBg: string | null;
  currentTheme: BundledTheme | null;
}

const diffConfig: DiffConfig = {
  addBg: null,
  removeBg: null,
  currentTheme: null,
};
function shouldStopReading(response: Buffer): boolean {
  const respStr = response.toString("hex");
  return (
    respStr.endsWith("1b5c") || respStr.endsWith("07") || response.length > 256
  );
}

function readTerminalResponse(): Buffer {
  let response = Buffer.alloc(0);
  while (true) {
    const chunk = process.stdin.read(1) as Buffer | null;
    if (!chunk || chunk.length === 0) break;
    response = Buffer.concat([response, chunk]);
    if (shouldStopReading(response)) break;
  }
  return response;
}
function parseColorResponse(response: Buffer): [number, number, number] | null {
  const str = response.toString("utf8");
  const match = str.match(
    /\x1b\]11;(rgb:[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+)(?:\x1b\\|\x07)/,
  );
  if (!match) return null;
  const [, color] = match;
  const [r, g, b] = color
    .slice(4)
    .split("/")
    .map((x: string) => parseInt(x, 16) >> 8);
  return [r, g, b];
}
function isTerminalInteractive(): boolean {
  return !!(process.stdout.isTTY && process.stdin.isTTY);
}

function getTerminalBgColor(): [number, number, number] | null {
  if (!isTerminalInteractive()) return null;
  try {
    return queryTerminalBgColor();
  } catch {
    return null;
  }
}

function queryTerminalBgColor(): [number, number, number] | null {
  const wasRaw = process.stdin.isRaw ?? false;
  if (!wasRaw) process.stdin.setRawMode(true);

  process.stdout.write("\x1b]11;?\x1b\\");
  const response = readTerminalResponse();

  if (!wasRaw) process.stdin.setRawMode(false);
  return parseColorResponse(response);
}

function hexToRGBA(hex: string): [number, number, number, number] {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (clean.length === 8) {
    const a = parseInt(clean.slice(6, 8), 16) / 255;
    return [r, g, b, a];
  }
  return [r, g, b, 1];
}

function blendColor(
  fg: [number, number, number, number],
  bg: [number, number, number],
): [number, number, number] {
  const [fgR, fgG, fgB, alpha] = fg;
  const [bgR, bgG, bgB] = bg;
  const invAlpha = 1 - alpha;
  return [
    Math.round(fgR * alpha + bgR * invAlpha),
    Math.round(fgG * alpha + bgG * invAlpha),
    Math.round(fgB * alpha + bgB * invAlpha),
  ];
}

function isDiffCacheValid(theme: BundledTheme): boolean {
  return !!(
    diffConfig.addBg &&
    diffConfig.removeBg &&
    diffConfig.currentTheme === theme
  );
}

function extractDiffColors(
  themeModule: {
    default?: { colors?: Record<string, string> };
  } | null,
): { green: string | undefined; red: string | undefined } {
  const colors = themeModule?.default?.colors || {};
  return {
    green: colors["diffEditor.insertedTextBackground"],
    red: colors["diffEditor.removedTextBackground"],
  };
}

async function initShiki(theme: BundledTheme): Promise<void> {
  if (isDiffCacheValid(theme)) return;
  await applyDiffTheme(theme);
}

async function applyDiffTheme(theme: BundledTheme): Promise<void> {
  const themeModule = await bundledThemes[theme]?.();
  const { green, red } = extractDiffColors(themeModule);
  const terminalBg = resolveTerminalBg();
  applyDiffConfig(green, red, terminalBg, theme);
}

function resolveTerminalBg(): [number, number, number] {
  return getTerminalBgColor() ?? [0, 0, 0];
}

function applyDiffConfig(
  green: string | undefined,
  red: string | undefined,
  terminalBg: [number, number, number],
  theme: BundledTheme,
): void {
  const addBgRGB = blendColor(hexToRGBA(green ?? "#00ff00"), terminalBg);
  const removeBgRGB = blendColor(hexToRGBA(red ?? "#ff0000"), terminalBg);
  diffConfig.addBg = `\x1b[48;2;${addBgRGB.join(";")}m`;
  diffConfig.removeBg = `\x1b[48;2;${removeBgRGB.join(";")}m`;
  diffConfig.currentTheme = theme;
}
const CACHE_LIMIT = 64;
const _cache = createLRUCache<string, string[]>(CACHE_LIMIT);

function _touch(k: string, v: string[]): string[] {
  return _cache.touch(k, v);
}

async function highlightLine(
  content: string,
  language: BundledLanguage | undefined,
  theme: BundledTheme,
): Promise<string> {
  if (!language || !content) return content;
  const k = `${theme}\0${language}\0${content}`;
  const cached = _cache.get(k);
  if (cached) return _touch(k, cached).join("\n");
  return await highlightLineCached(content, language, theme, k);
}

async function highlightLineCached(
  content: string,
  language: BundledLanguage,
  theme: BundledTheme,
  cacheKey: string,
): Promise<string> {
  try {
    const ansi = await codeToANSI(content, language, theme);
    const out = stripTrailingNewline(ansi).split("\n");
    return _touch(cacheKey, out).join("\n");
  } catch {
    return content;
  }
}

function stripTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}
function applyBgColor(bg: string | null, content: string): string {
  if (bg) return `${bg}${content}\x1b[0m`;
  return content;
}

function colorDiffLine(line: DiffLine, highlightedContent: string): string {
  if (line.type === "add")
    return applyBgColor(diffConfig.addBg, highlightedContent);
  if (line.type === "remove")
    return applyBgColor(diffConfig.removeBg, highlightedContent);
  return highlightedContent;
}
interface ProcessHunkOptions {
  hunk: DiffHunkBlock;
  file: DiffHunk;
  language: BundledLanguage | undefined;
  theme: BundledTheme;
  output: string[];
}

async function processHunk(options: ProcessHunkOptions): Promise<void> {
  const { hunk, file, language, theme, output } = options;
  if (file.hunks[0] === hunk) {
    output.push(`\x1b[1m${file.file}\x1b[0m`, "");
  }
  output.push(`\x1b[90m${hunk.header}\x1b[0m`);

  for (const line of hunk.lines) {
    if (line.type === "empty") {
      output.push("");
      continue;
    }
    const highlighted = await highlightLine(line.content, language, theme);
    output.push(colorDiffLine(line, highlighted));
  }
}
export async function renderDiffWithShiki(
  diff: string,
  theme: BundledTheme,
): Promise<string[]> {
  await initShiki(theme);
  const parsed = parseGitDiff(diff);
  const output: string[] = [];

  for (const file of parsed) {
    const language = lang(file.file);
    for (const hunk of file.hunks) {
      await processHunk({ hunk, file, language, theme, output });
    }
    output.push("");
  }

  return output;
}
