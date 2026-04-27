import { codeToANSI } from "@shikijs/cli";
import type { BundledLanguage } from "shiki";
import { createLRUCache } from "../../../../shared/cache";
import { THEME, MAX_HL_CHARS, CACHE_LIMIT } from "../shiki-constants";
import { normalizeShikiContrast } from "./contrast";

const _cache = createLRUCache<string, string[]>(CACHE_LIMIT);

export async function highlightCode(
  code: string,
  language: BundledLanguage | undefined,
  mutedColor = "\x1b[38;2;187;187;187m",
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
