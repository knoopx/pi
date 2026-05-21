import { codeToANSI } from "@shikijs/cli";
import { getSingletonHighlighter, type BundledLanguage } from "shiki";
import { createLRUCache } from "../lru-cache";
import { THEME, MAX_HL_CHARS, CACHE_LIMIT } from "./constants";
import { normalizeShikiContrast } from "./contrast";

void getSingletonHighlighter().catch(() => {});

function shouldHighlight(
  code: string,
  language: BundledLanguage | undefined,
): language is BundledLanguage {
  return !!(language && code.length <= MAX_HL_CHARS);
}

function cacheKey(language: string, code: string): string {
  return `${THEME}\0${language}\0${code}`;
}

function processAnsiOutput(ansi: string): string[] {
  return (ansi.endsWith("\n") ? ansi.slice(0, -1) : ansi).split("\n");
}

async function doHighlight(
  code: string,
  language: BundledLanguage,
  mutedColor: string,
): Promise<string[]> {
  const ansi = normalizeShikiContrast(
    await codeToANSI(code, language, THEME),
    mutedColor,
  );
  return processAnsiOutput(ansi);
}

const _cache = createLRUCache<string, string[]>(CACHE_LIMIT);
export async function highlightCode(
  code: string,
  language: BundledLanguage | undefined,
  mutedColor = "\x1b[38;2;187;187;187m",
): Promise<string[]> {
  if (!code) return [""];
  if (!shouldHighlight(code, language)) return code.split("\n");
  const k = cacheKey(language, code);
  const cached = getCachedHighlight(k);
  if (cached) return cached;
  return highlightAndCache(code, language, mutedColor, k);
}

function getCachedHighlight(key: string): string[] | null {
  const hit = _cache.get(key);
  if (!hit) return null;
  return _cache.touch(key, hit);
}

async function highlightAndCache(
  code: string,
  language: BundledLanguage,
  mutedColor: string,
  key: string,
): Promise<string[]> {
  try {
    const out = await doHighlight(code, language, mutedColor);
    return _cache.touch(key, out);
  } catch {
    return code.split("\n");
  }
}
