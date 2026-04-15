import { codeToANSI } from "@shikijs/cli";
import type { BundledLanguage, BundledTheme } from "shiki";
import { createLRUCache } from "../../../shared/cache";
import { THEME, MAX_HL_CHARS, CACHE_LIMIT } from "./shiki-constants";
const _cache = createLRUCache<string, string[]>(CACHE_LIMIT);
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
export async function hlBlock(
  code: string,
  language: BundledLanguage | undefined,
  mutedColor: string,
): Promise<string[]> {
  if (!code) return [""];
  if (!language || code.length > MAX_HL_CHARS) return code.split("\n");
  const k = `${THEME}\0${language}\0${code}`;
  const hit = _cache.get(k);
  if (hit) return _cache.touch(k, hit);
  try {
    const ansi = normalizeShikiContrast(
      await codeToANSI(code, language, THEME),
      mutedColor,
    );
    const out = (ansi.endsWith("\n") ? ansi.slice(0, -1) : ansi).split("\n");
    return _cache.touch(k, out);
  } catch {
    return code.split("\n");
  }
}
