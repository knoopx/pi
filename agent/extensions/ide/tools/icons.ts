import { basename, extname } from "node:path";

const ICONS_MODE = (process.env.PRETTY_ICONS ?? "nerd").toLowerCase();
const USE_ICONS = ICONS_MODE !== "none" && ICONS_MODE !== "off";

export const NF_DIR = "\ue5ff";
export const NF_DEFAULT = "\uf15b";

export const EXT_ICON: Record<string, string> = {
  ts: "\ue628",
  tsx: "\ue7ba",
  js: "\ue74e",
  jsx: "\ue7ba",
  mjs: "\ue74e",
  cjs: "\ue74e",
  py: "\ue73c",
  rs: "\ue7a8",
  go: "\ue724",
  java: "\ue738",
  swift: "\ue755",
  rb: "\ue739",
  kt: "\ue634",
  c: "\ue61e",
  cpp: "\ue61d",
  h: "\ue61e",
  hpp: "\ue61d",
  cs: "\ue648",
  html: "\ue736",
  css: "\ue749",
  scss: "\ue749",
  less: "\ue749",
  vue: "\ue6a0",
  svelte: "\ue697",
  json: "\ue60b",
  jsonc: "\ue60b",
  yaml: "\ue6a8",
  yml: "\ue6a8",
  toml: "\ue6b2",
  xml: "\ue619",
  sql: "\ue706",
  md: "\ue73e",
  mdx: "\ue73e",
  sh: "\ue795",
  bash: "\ue795",
  zsh: "\ue795",
  fish: "\ue795",
  lua: "\ue620",
  php: "\ue73d",
  dart: "\ue798",
  png: "\uf1c5",
  jpg: "\uf1c5",
  jpeg: "\uf1c5",
  gif: "\uf1c5",
  svg: "\uf1c5",
  webp: "\uf1c5",
  ico: "\uf1c5",
  lock: "\uf023",
  env: "\ue615",
  graphql: "\ue662",
  dockerfile: "\ue7b0",
};

export const NAME_ICON: Record<string, string> = {
  "package.json": "\ue71e",
  "package-lock.json": "\ue71e",
  "tsconfig.json": "\ue628",
  "biome.json": "\ue615",
  ".gitignore": "\ue702",
  ".git": "\ue702",
  ".env": "\ue615",
  ".envrc": "\ue615",
  dockerfile: "\ue7b0",
  makefile: "\ue615",
  gnumakefile: "\ue615",
  "readme.md": "\ue73e",
  license: "\ue60a",
  "cargo.toml": "\ue7a8",
  "go.mod": "\ue724",
  "pyproject.toml": "\ue73c",
};

export function fileIconGlyph(fp: string): string {
  if (!USE_ICONS) return "";
  const base = basename(fp).toLowerCase();
  if (NAME_ICON[base]) return `${NAME_ICON[base]} `;
  const ext = extname(fp).slice(1).toLowerCase();
  return EXT_ICON[ext] ? `${EXT_ICON[ext]} ` : `${NF_DEFAULT} `;
}

export function dirIconGlyph(): string {
  return USE_ICONS ? `${NF_DIR} ` : "";
}
