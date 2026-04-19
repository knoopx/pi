import type { Component } from "@mariozechner/pi-tui";
import { truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  ensureWidth,
  renderEmptyRow,
  renderEmptyRowWithReset,
  truncateAnsi,
} from "../text-utils";


export function createEmptyChangeRow(message: string, theme: Theme): Component {
  return {
    render(width: number): string[] {
      const text = theme.fg("dim", ` ${message}`);
      return [ensureWidth(truncateAnsi(text, width), width)];
    },
    invalidate(): void {},
  };
}


export function createEmptyDiffRow(message: string, theme: Theme): Component {
  return {
    render(width: number): string[] {
      return [renderEmptyRowWithReset(message, width, theme)];
    },
    invalidate(): void {},
  };
}


export function createEmptyFileChangeRow(
  message: string,
  theme: Theme,
): Component {
  return {
    render(width: number): string[] {
      return [renderEmptyFileChangeLine(message, width, theme)];
    },
    invalidate(): void {},
  };
}

function renderEmptyFileChangeLine(
  message: string,
  width: number,
  theme: Theme,
): string {
  return truncateToWidth(
    renderEmptyRow(message, width, theme),
    width,
    "",
    true,
  );
}
