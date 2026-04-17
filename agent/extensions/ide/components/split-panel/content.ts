import type { Theme } from "@mariozechner/pi-coding-agent";
import { ensureWidth, pad, truncateAnsi } from "../text-utils";
import { expandTabs } from "./utils";
import { getChangeIcon } from "../changes/formatting";
import {
  getFileStatusIcon,
  getFileIcon,
  getFileIconColor,
} from "../file-icons";
import { highlightCodeLines } from "../file-preview";
import { FileChangeRow, EmptyFileChangeRow } from "./file-change-row";
import { ChangeRow, EmptyChangeRow } from "./change-row";
import { DiffRow, EmptyDiffRow } from "./diff-row";
import { ListRow } from "./list-row";

/**
 * Render source code rows with line highlighting.
 * Each row is a pi-tui Component for independent state management.
 */
export function renderSourceRows(
  lines: string[],
  width: number,
  height: number,
  scroll: number,
  theme: Theme,
  highlightRange?: { start: number; end: number },
): string[] {
  if (lines.length === 0) {
    const empty = new EmptyDiffRow(" No preview available", theme);
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

/** Shared pattern for rendering diff lines into rows. */
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

/**
 * Generate rows for diff content (preserves ANSI colors from jj).
 * Each row is a pi-tui Component for independent state management.
 */
export function renderDiffRows(
  lines: string[],
  width: number,
  height: number,
  scroll: number,
  theme: Theme,
): string[] {
  if (lines.length === 0) {
    const empty = new EmptyDiffRow(" No content", theme);
    return empty.render(width);
  }

  const visible = lines.slice(scroll, scroll + height);
  return renderDiffLinesToRows(visible, width, theme);
}

/**
 * Render file change rows with status colors.
 * Each row is a pi-tui Component for independent state management.
 */
export function renderFileChangeRows(
  files: {
    status: string;
    path: string;
    insertions?: number;
    deletions?: number;
  }[],
  width: number,
  height: number,
  fileIndex: number,
  theme: Theme,
  emptyMessage = " No files changed",
): string[] {
  if (files.length === 0) {
    const empty = new EmptyFileChangeRow(emptyMessage, theme);
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

/**
 * Render change/commit rows with selection and icons.
 * Each row is a pi-tui Component for independent state management.
 */
export function renderChangeRows(
  changes: {
    changeId: string;
    description: string;
    empty: boolean;
  }[],
  width: number,
  height: number,
  selectedIndex: number,
  isFocused: boolean,
  theme: Theme,
  emptyMessage = " No changes",
): string[] {
  if (changes.length === 0) {
    const empty = new EmptyChangeRow(emptyMessage, theme);
    return empty.render(width);
  }

  const visibleCount = height;
  let startIdx = 0;
  if (selectedIndex >= visibleCount)
    startIdx = selectedIndex - visibleCount + 1;

  const rows: string[] = [];
  for (let i = 0; i < visibleCount && startIdx + i < changes.length; i++) {
    const idx = startIdx + i;
    const change = changes[idx];
    const isSelected = idx === selectedIndex && isFocused;
    const isCurrent = idx === 0;

    const icon = getChangeIcon(isCurrent, change.empty);
    const shortId = change.changeId.slice(0, 8);
    const desc = truncateAnsi(change.description, width - 13);
    const text = ` ${icon} ${shortId} ${desc}`;

    const row = new ListRow({
      text,
      isSelected: isSelected || false,
      isCurrent,
      theme,
    });
    rows.push(row.render(width)[0]);
  }

  return rows;
}
