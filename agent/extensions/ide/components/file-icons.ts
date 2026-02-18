/** File extension to Nerd Font icon mapping */
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

export function getFileStatusIcon(status: string): string {
  return FILE_STATUS_ICONS[status] || status;
}

export function getFileIconColor(filePath: string): string | null {
  if (filePath.endsWith("/")) return "#90a4ae";
  const filename = getFilename(filePath);

  if (FILENAME_COLORS[filename]) {
    return FILENAME_COLORS[filename];
  }

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    if (FILE_ICON_COLORS[ext]) {
      return FILE_ICON_COLORS[ext];
    }
  }

  return null;
}

export function getFileIcon(filePath: string): string {
  if (filePath.endsWith("/")) return "󰉋";
  const filename = getFilename(filePath);

  if (FILENAME_ICONS[filename]) {
    return FILENAME_ICONS[filename];
  }

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex > 0) {
    const ext = filename.slice(dotIndex).toLowerCase();
    if (FILE_ICONS[ext]) {
      return FILE_ICONS[ext];
    }
  }

  return "󰈙";
}
