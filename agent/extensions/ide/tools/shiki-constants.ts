import type { BundledLanguage, BundledTheme } from "shiki";

const THEME: BundledTheme =
  (process.env.PRETTY_THEME as BundledTheme | undefined) ?? "github-dark";
const MAX_HL_CHARS =
  Number.parseInt(process.env.PRETTY_MAX_HL_CHARS ?? "", 10) || 80_000;
export const MAX_PREVIEW_LINES =
  Number.parseInt(process.env.PRETTY_MAX_PREVIEW_LINES ?? "", 10) || 80;
const CACHE_LIMIT =
  Number.parseInt(process.env.PRETTY_CACHE_LIMIT ?? "", 10) || 128;

export { THEME, MAX_HL_CHARS, CACHE_LIMIT };
