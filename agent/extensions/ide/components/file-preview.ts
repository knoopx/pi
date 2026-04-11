import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import { hlBlock } from "../tools/shiki";
import { lang } from "../tools/language";

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
 * Load file preview using Shiki for syntax highlighting.
 * Shared across files and symbols components.
 */
export async function loadFilePreviewWithShiki(
  filePath: string,
  content: string,
  theme: Theme,
): Promise<string[]> {
  try {
    const mutedColor = theme.getFgAnsi("muted");
    const language = lang(filePath);
    return hlBlock(content, language, mutedColor);
  } catch {
    return content.split("\n");
  }
}
