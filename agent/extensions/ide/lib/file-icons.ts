const ICONS_MODE = (process.env.PRETTY_ICONS ?? "nerd").toLowerCase();
const USE_ICONS = ICONS_MODE !== "none" && ICONS_MODE !== "off";
const DIR_ICON = "\ue5ff";
const DEFAULT_ICON = "\uf15b";
const EXT_ICON: Record<string, string> = {
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
const NAME_ICON: Record<string, string> = {
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
  const base = getFilename(fp).toLowerCase();
  if (NAME_ICON[base]) return `${NAME_ICON[base]} `;
  const ext = getExt(fp).toLowerCase();
  return EXT_ICON[ext] ? `${EXT_ICON[ext]} ` : `${DEFAULT_ICON} `;
}
export function dirIconGlyph(): string {
  return USE_ICONS ? `${DIR_ICON} ` : "";
}

const FILE_ICONS: Record<string, string> = {
  ".ts": "󰛦",
  ".tsx": "󰜈",
  ".mts": "󰛦",
  ".cts": "󰛦",
  ".js": "󰌞",
  ".jsx": "󰜈",
  ".mjs": "󰌞",
  ".cjs": "󰌞",
  ".html": "󰌝",
  ".css": "󰌜",
  ".scss": "󰌜",
  ".less": "󰌜",
  ".vue": "󰡄",
  ".svelte": "󰡄",
  ".json": "󰘦",
  ".yaml": "󰈙",
  ".yml": "󰈙",
  ".toml": "󰈙",
  ".xml": "󰈙",
  ".env": "󰈙",
  ".md": "󰍔",
  ".mdx": "󰍔",
  ".txt": "󰈙",
  ".rst": "󰍔",
  ".py": "󰌠",
  ".rs": "󱘗",
  ".go": "󰟓",
  ".rb": "󰴭",
  ".php": "󰌟",
  ".java": "󰬷",
  ".kt": "󱈙",
  ".c": "󰙱",
  ".cpp": "󰙲",
  ".h": "󰙱",
  ".hpp": "󰙲",
  ".cs": "󰌛",
  ".swift": "󰛥",
  ".lua": "󰢱",
  ".sh": "󰆍",
  ".bash": "󰆍",
  ".zsh": "󰆍",
  ".fish": "󰆍",
  ".nix": "󱄅",
  ".png": "󰋩",
  ".jpg": "󰋩",
  ".jpeg": "󰋩",
  ".gif": "󰋩",
  ".svg": "󰋩",
  ".ico": "󰋩",
  ".webp": "󰋩",
  ".gitignore": "󰊢",
  ".gitmodules": "󰊢",
  ".gitattributes": "󰊢",
  ".lock": "󰌾",
};
const FILENAME_ICONS: Record<string, string> = {
  "package.json": "󰎙",
  "tsconfig.json": "󰛦",
  Dockerfile: "󰡨",
  "docker-compose.yml": "󰡨",
  "docker-compose.yaml": "󰡨",
  ".dockerignore": "󰡨",
  Makefile: "󱁤",
  "CMakeLists.txt": "󱁤",
  "flake.nix": "󱄅",
  "flake.lock": "󱄅",
  "Cargo.toml": "󱘗",
  "Cargo.lock": "󱘗",
  "go.mod": "󰟓",
  "go.sum": "󰟓",
  "requirements.txt": "󰌠",
  "pyproject.toml": "󰌠",
  Gemfile: "󰴭",
  "Gemfile.lock": "󰴭",
  LICENSE: "󰿃",
  "README.md": "󰍔",
  "CHANGELOG.md": "󰍔",
  "AGENTS.md": "󰍔",
};
const FILE_STATUS_ICONS: Record<string, string> = {
  A: "󰐕",
  M: "󰏫",
  D: "󰍴",
  R: "󰑕",
  C: "󰆏",
};
const FILE_ICON_COLORS: Record<string, string> = {
  ".ts": "#3178c6",
  ".tsx": "#3178c6",
  ".mts": "#3178c6",
  ".cts": "#3178c6",
  ".js": "#f0db4f",
  ".jsx": "#61dafb",
  ".mjs": "#f0db4f",
  ".cjs": "#f0db4f",
  ".html": "#e34c26",
  ".css": "#563d7c",
  ".scss": "#c6538c",
  ".less": "#1d365d",
  ".vue": "#41b883",
  ".svelte": "#ff3e00",
  ".json": "#cbcb41",
  ".yaml": "#cb171e",
  ".yml": "#cb171e",
  ".toml": "#9c4221",
  ".xml": "#e37933",
  ".env": "#ecd53f",
  ".md": "#519aba",
  ".mdx": "#519aba",
  ".txt": "#89e051",
  ".rst": "#89e051",
  ".py": "#3572a5",
  ".rs": "#dea584",
  ".go": "#00add8",
  ".rb": "#cc342d",
  ".php": "#4f5d95",
  ".java": "#b07219",
  ".kt": "#a97bff",
  ".c": "#555555",
  ".cpp": "#f34b7d",
  ".h": "#555555",
  ".hpp": "#f34b7d",
  ".cs": "#178600",
  ".swift": "#f05138",
  ".lua": "#000080",
  ".sh": "#89e051",
  ".bash": "#89e051",
  ".zsh": "#89e051",
  ".fish": "#89e051",
  ".nix": "#7ebae4",
  ".png": "#a074c4",
  ".jpg": "#a074c4",
  ".jpeg": "#a074c4",
  ".gif": "#a074c4",
  ".svg": "#ffb13b",
  ".ico": "#a074c4",
  ".webp": "#a074c4",
  ".gitignore": "#f14e32",
  ".gitmodules": "#f14e32",
  ".gitattributes": "#f14e32",
  ".lock": "#6b7280",
};
const FILENAME_COLORS: Record<string, string> = {
  "package.json": "#cb3837",
  "tsconfig.json": "#3178c6",
  Dockerfile: "#384d54",
  "docker-compose.yml": "#384d54",
  "docker-compose.yaml": "#384d54",
  ".dockerignore": "#384d54",
  Makefile: "#6d8086",
  "CMakeLists.txt": "#6d8086",
  "flake.nix": "#7ebae4",
  "flake.lock": "#7ebae4",
  "Cargo.toml": "#dea584",
  "Cargo.lock": "#dea584",
  "go.mod": "#00add8",
  "go.sum": "#00add8",
  "requirements.txt": "#3572a5",
  "pyproject.toml": "#3572a5",
  Gemfile: "#cc342d",
  "Gemfile.lock": "#cc342d",
  LICENSE: "#d4af37",
  "README.md": "#519aba",
  "CHANGELOG.md": "#519aba",
  "AGENTS.md": "#519aba",
};
function getFilename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || "";
}
function getExt(filePath: string): string {
  const filename = getFilename(filePath);
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) return filename.slice(dotIndex + 1).toLowerCase();
  return "";
}
export function getFileIcon(filePath: string): string {
  if (filePath.endsWith("/")) return "󰉋";
  const filename = getFilename(filePath);

  if (FILENAME_ICONS[filename]) return FILENAME_ICONS[filename];
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    if (FILE_ICONS[ext]) return FILE_ICONS[ext];
  }

  return "󰈙";
}
export function getFileStatusIcon(status: string): string {
  return FILE_STATUS_ICONS[status] || status;
}
export function getFileIconColor(filePath: string): string | null {
  if (filePath.endsWith("/")) return "#90a4ae";
  const filename = getFilename(filePath);

  if (FILENAME_COLORS[filename]) return FILENAME_COLORS[filename];
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    if (FILE_ICON_COLORS[ext]) return FILE_ICON_COLORS[ext];
  }

  return null;
}
