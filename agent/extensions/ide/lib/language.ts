import { basename, extname } from "node:path";
import type { BundledLanguage } from "shiki";
const EXT_LANG: Record<string, BundledLanguage> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  kt: "kotlin",
  html: "html",
  css: "css",
  scss: "scss",
  less: "css",
  json: "json",
  jsonc: "jsonc",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  mdx: "mdx",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  lua: "lua",
  php: "php",
  dart: "dart",
  xml: "xml",
  graphql: "graphql",
  svelte: "svelte",
  vue: "vue",
  dockerfile: "dockerfile",
  makefile: "make",
  zig: "zig",
  nim: "nim",
  elixir: "elixir",
  ex: "elixir",
  nix: "nix",
  erb: "erb",
  hbs: "handlebars",
};
const SPECIAL_FILES: Record<string, BundledLanguage> = {
  dockerfile: "dockerfile",
  "flake.lock": "json",
  makefile: "make",
  gnumakefile: "make",
  ".envrc": "bash",
  ".env": "bash",
};

function resolveSpecialFilename(base: string): BundledLanguage | null {
  return SPECIAL_FILES[base] ?? null;
}

export function lang(fp: string): BundledLanguage | undefined {
  const base = basename(fp).toLowerCase();
  const special = resolveSpecialFilename(base);
  if (special) return special;
  return EXT_LANG[extname(fp).slice(1).toLowerCase()];
}
