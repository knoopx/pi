import type { Theme } from "@mariozechner/pi-coding-agent";
import { expandTabs } from "./utils";
import { highlightCodeLines } from "../file-preview";
import { FileChangeRow } from "./file-change-row";
import { DiffRow } from "./diff-row";
import { createEmptyDiffRow, createEmptyFileChangeRow } from "./empty-rows";

export function renderSourceRows(options: {
  lines: string[];
  width: number;
  height: number;
  scroll: number;
  theme: Theme;
  highlightRange?: { start: number; end: number };
}): string[] {
  const { lines, width, height, scroll, theme, highlightRange } = options;
  if (lines.length === 0) {
    const empty = createEmptyDiffRow(" No preview available", theme);
    return empty.render(width);
  }

  const visible = lines.slice(scroll, scroll + scroll + height);
  const rows: string[] = [];

  for (let i = 0; i < visible.length; i++) {
    const lineNum = scroll + i + 1;
    const isHighlighted =
      highlightRange &&
      lineNum >= highlightRange.start &&
      lineNum <= highlightRange.end;

    const styledLine = highlightCodeLines(
      visible[i],
      theme,
      isHighlighted ? "accent" : undefined,
    );
    const row = new DiffRow({
      line: ` ${styledLine}`,
      isDivider: false,
      theme,
    });
    rows.push(row.render(width)[0]);
  }

  return rows;
}

export function renderDiffLinesToRows(
  lines: string[],
  width: number,
  theme: Theme,
): string[] {
  const rows: string[] = [];
  const hunkDividerPattern = /^─+ line \d+ ─+$/;
  for (const line of lines) {
    const expanded = expandTabs(line);
    const isDivider = hunkDividerPattern.test(expanded);
    const row = new DiffRow({ line: ` ${expanded}`, isDivider, theme });
    rows.push(row.render(width)[0]);
  }
  return rows;
}

export function renderFileChangeRows(options: {
  files: {
    status: string;
    path: string;
    insertions?: number;
    deletions?: number;
  }[];
  width: number;
  height: number;
  fileIndex: number;
  theme: Theme;
  emptyMessage?: string;
}): string[] {
  const {
    files,
    width,
    height,
    fileIndex,
    theme,
    emptyMessage = " No files changed",
  } = options;
  if (files.length === 0) {
    const empty = createEmptyFileChangeRow(emptyMessage, theme);
    return empty.render(width);
  }

  const visibleCount = height;
  let startIdx = 0;
  if (fileIndex >= visibleCount) startIdx = fileIndex - visibleCount + 1;

  const rows: string[] = [];
  for (let i = 0; i < visibleCount && startIdx + i < files.length; i++) {
    const idx = startIdx + i;
    const file = files[idx];
    const isSelected = idx === fileIndex;
    const row = new FileChangeRow({ file, isSelected, theme });
    rows.push(row.render(width)[0]);
  }

  return rows;
}
