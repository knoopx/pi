import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import { highlightCode } from "../tools/shiki/highlight";
import { lang } from "../tools/language";

export function highlightCodeLines(
  line: string,
  theme: Theme,
  accentColor?: ThemeColor,
): string {
  if (accentColor) return theme.fg(accentColor, line);
  return line;
}

export function loadFilePreviewWithShiki(
  filePath: string,
  content: string,
  theme: Theme,
): Promise<string[]> {
  try {
    const mutedColor = theme.getFgAnsi("muted");
    const language = lang(filePath);
    return highlightCode(content, language, mutedColor);
  } catch {
    return Promise.resolve(content.split("\n"));
  }
}
