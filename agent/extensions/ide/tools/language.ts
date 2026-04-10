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
  erb: "erb",
  hbs: "handlebars",
};

export function lang(fp: string): BundledLanguage | undefined {
  const base = basename(fp).toLowerCase();
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile" || base === "gnumakefile") return "make";
  if (base === ".envrc" || base === ".env") return "bash";
  return EXT_LANG[extname(fp).slice(1).toLowerCase()];
}
