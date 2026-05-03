import type { Theme } from "@mariozechner/pi-coding-agent";
import { basename } from "node:path";
import { BOX } from "../../lib/ui/frame";
import { ensureWidth, pad } from "../../lib/text-utils";
import { renderEditorView } from "./renderer";
import type { RenderOptions } from "./renderer";
import { highlightCode } from "../../tools/shiki/highlight";
import { lang } from "../../tools/language";
import { buildHelpFromBindings, filterActiveBindings } from "../../keyboard";
import { formatHelpWithStatus } from "../../lib/ui/status";

export function renderHeader(
  theme: Theme,
  filePath: string,
  innerWidth: number,
): string[] {
  const fileName = basename(filePath);
  const titleText = ` Editing: ${fileName}`;
  const titlePadded = pad(titleText, innerWidth);

  return [
    theme.fg("borderAccent", BOX.topLeft) +
      theme.fg("borderAccent", BOX.horizontal.repeat(innerWidth)) +
      theme.fg("borderAccent", BOX.topRight),
    theme.fg("borderAccent", BOX.vertical) +
      theme.fg("accent", titlePadded) +
      theme.fg("borderAccent", BOX.vertical),
    theme.fg("borderAccent", BOX.teeLeft) +
      theme.fg("borderAccent", BOX.horizontal.repeat(innerWidth)) +
      theme.fg("borderAccent", BOX.teeRight),
  ];
}

export function renderContentRows(
  theme: Theme,
  contentLines: string[],
  innerWidth: number,
): string[] {
  const rightBorder = theme.fg("border", BOX.vertical);
  return contentLines.map(
    (line) =>
      theme.fg("border", BOX.vertical) +
      ensureWidth(line, innerWidth - 2) +
      rightBorder,
  );
}

export function renderFooter(
  theme: Theme,
  statusState: { message: { text: string; type: "error" | "info" } | null },
  bindings: import("../../keyboard").KeyBinding[],
  innerWidth: number,
): string[] {
  const activeBindings = filterActiveBindings(bindings);
  const helpContent = buildHelpFromBindings(activeBindings);
  const helpPrefix = theme.fg("dim", " esc quit");
  const fullHelp = helpContent ? `${helpPrefix}  ${helpContent}` : helpPrefix;
  const helpText = formatHelpWithStatus(theme, statusState.message, fullHelp);
  const helpPadded = pad(` ${helpText}`, innerWidth);

  return [
    theme.fg("border", BOX.vertical) +
      helpPadded +
      theme.fg("border", BOX.vertical),
    theme.fg("border", BOX.bottomLeft) +
      theme.fg("border", BOX.horizontal.repeat(innerWidth)) +
      theme.fg("border", BOX.bottomRight),
  ];
}

export function computeHlKey(
  filePath: string,
  lines: readonly string[],
): string {
  return `${filePath}\0${lines.join("\n")}`;
}

export async function tryHighlight(
  filePath: string,
  source: string,
): Promise<readonly string[] | null> {
  try {
    const language = lang(filePath);
    return await highlightCode(source, language, undefined);
  } catch {
    return null;
  }
}

export function renderWithDisplayLines(
  theme: Theme,
  opts: {
    displayLines: readonly string[];
    innerWidth: number;
    height: number;
    cursor: { line: number; col: number };
    topLine: number;
    selection: {
      start: { line: number; col: number };
      end: { line: number; col: number };
    } | null;
  },
): { lines: string[] } {
  const { displayLines, innerWidth, height, cursor, topLine, selection } = opts;
  const renderOpts: RenderOptions = {
    lines: [...displayLines],
    width: innerWidth - 1,
    height,
    cursor,
    topLine,
    showCursor: true,
    selection,
  };

  return renderEditorView(theme, renderOpts);
}
