import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import { hlBlock } from "../tools/shiki";
import { lang } from "../tools/language";

/** Text file extensions that we can preview */
const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".markdown",
  ".txt",
  ".csv",
  ".toml",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".sql",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".py",
  ".rb",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".php",
  ".swift",
  ".kt",
  ".kts",
  ".scala",
  ".lua",
  ".r",
  ".R",
  ".pl",
  ".pm",
  ".ps1",
  ".psm1",
  ".psd1",
  ".ps1xml",
  ".nix",
  ".ml",
  ".mli",
  ".hs",
  ".ex",
  ".exs",
  ".erl",
  ".hrl",
  ".clj",
  ".cljs",
  ".cljc",
  ".edn",
  ".dart",
  ".groovy",
  ".vue",
  ".svelte",
  ".elm",
  ".fs",
  ".fsi",
  ".fsx",
  ".fsscript",
  ".graphql",
  ".gql",
  ".proto",
  ".thrift",
  ".coffee",
  ".ejs",
  ".pug",
  ".hbs",
  ".mustache",
  ".twig",
  ".blade",
  ".rst",
  ".adoc",
  ".asciidoc",
  ".org",
  ".textile",
  ".wiki",
  ".mediawiki",
  ".diff",
  ".patch",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
  ".rc",
  ".bashrc",
  ".zshrc",
  ".profile",
  ".bash_profile",
  ".bash_login",
  ".inputrc",
  ".gitconfig",
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  ".dockerignore",
  ".npmignore",
  ".nvmrc",
  ".python-version",
  ".ruby-version",
  ".node-version",
  ".tool-versions",
  ".ruby-gemset",
]);

/** Check if a file path is supported for text preview */
function isSupportedFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Highlight code lines with optional accent color.
 */
export function highlightCodeLines(
  line: string,
  theme: Theme,
  accentColor?: ThemeColor,
): string {
  if (accentColor) return theme.fg(accentColor, line);
  return line;
}

/**
 * Load file preview using Shiki for syntax highlighting.
 * Returns empty array for unsupported file types.
 * Shared across files and symbols components.
 */
export async function loadFilePreviewWithShiki(
  filePath: string,
  content: string,
  theme: Theme,
): Promise<string[]> {
  // Only render supported file types
  if (!isSupportedFile(filePath)) return [];

  try {
    const mutedColor = theme.getFgAnsi("muted");
    const language = lang(filePath);
    return hlBlock(content, language, mutedColor);
  } catch {
    return content.split("\n");
  }
}
