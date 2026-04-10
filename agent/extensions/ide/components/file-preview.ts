import type {
  ExtensionAPI,
  Theme,
  ThemeColor,
} from "@mariozechner/pi-coding-agent";

/**
 * Highlight code lines with optional accent color.
 */
export function highlightCodeLines(
  line: string,
  theme: Theme,
  accentColor?: ThemeColor,
): string {
  if (accentColor) {
    return theme.fg(accentColor, line);
  }
  return line;
}

/**
 * Load file preview using bat with syntax highlighting.
 * Shared across files and symbols components.
 */
export async function loadFilePreviewWithBat(
  pi: ExtensionAPI,
  filePath: string,
  cwd: string,
): Promise<string[]> {
  const result = await pi.exec("bat", ["--plain", "--color=always", filePath], {
    cwd,
  });
  if (result.code === 0) {
    return result.stdout.split("\n");
  }
  return [`Error reading file: ${result.stderr}`];
}
