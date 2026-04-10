import { codeToANSI } from "@shikijs/cli";
import type { BundledLanguage, BundledTheme } from "shiki";

const THEME: BundledTheme =
  (process.env.PRETTY_THEME as BundledTheme | undefined) ?? "github-dark";

function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const MAX_HL_CHARS = envInt("PRETTY_MAX_HL_CHARS", 80_000);
export const MAX_PREVIEW_LINES = envInt("PRETTY_MAX_PREVIEW_LINES", 80);
const CACHE_LIMIT = envInt("PRETTY_CACHE_LIMIT", 128);

const ANSI_CAPTURE_RE = /\x1b\[([0-9;]*)m/g;

function isLowContrastShikiFg(params: string): boolean {
  if (params === "30" || params === "90") return true;
  if (params === "38;5;0" || params === "38;5;8") return true;
  if (!params.startsWith("38;2;")) return false;
  const parts = params.split(";").map(Number);
  if (parts.length !== 5 || parts.some((n) => !Number.isFinite(n)))
    return false;
  const [, , r, g, b] = parts;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 72;
}

function normalizeShikiContrast(ansi: string, mutedColor: string): string {
  return ansi.replace(ANSI_CAPTURE_RE, (seq, params: string) =>
    isLowContrastShikiFg(params) ? mutedColor : seq,
  );
}

// Pre-warm Shiki
codeToANSI("", "typescript", THEME).catch(() => {});

const _cache = new Map<string, string[]>();

function _touch(k: string, v: string[]): string[] {
  _cache.delete(k);
  _cache.set(k, v);
  while (_cache.size > CACHE_LIMIT) {
    const first = _cache.keys().next().value;
    if (first === undefined) break;
    _cache.delete(first);
  }
  return v;
}

export async function hlBlock(
  code: string,
  language: BundledLanguage | undefined,
  mutedColor: string,
): Promise<string[]> {
  if (!code) return [""];
  if (!language || code.length > MAX_HL_CHARS) return code.split("\n");

  const k = `${THEME}\0${language}\0${code}`;
  const hit = _cache.get(k);
  if (hit) return _touch(k, hit);

  try {
    const ansi = normalizeShikiContrast(
      await codeToANSI(code, language, THEME),
      mutedColor,
    );
    const out = (ansi.endsWith("\n") ? ansi.slice(0, -1) : ansi).split("\n");
    return _touch(k, out);
  } catch {
    return code.split("\n");
  }
}
