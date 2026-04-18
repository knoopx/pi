/**
 * ChangeRow — single change list item row renderer.
 * Handles graph prefix, text formatting, width calculation, and assembly.
 */

import type { Theme } from "@mariozechner/pi-coding-agent";
import type { GraphLayout } from "../graph";
import { formatChangeRow } from "./formatting";
import { renderGraphPrefix, assembleChangeRow } from "../change-row-utils";

interface ChangeRowFlags {
  isCursor: boolean;
  isMarked: boolean;
  isFocused: boolean;
  isWorkingCopy: boolean;
}

/**
 * Renders a single change list row to the exact target width.
 * Width calculation strips all ANSI codes so padding is accurate regardless
 * of styling. The background highlight (if any) is applied last, after all
 * width computations are finished — this prevents the BG wrapper from
 * corrupting `ensureWidth` which relies on stripping OSC sequences.
 */
export class ChangeRowRenderer {
  constructor(
    private readonly theme: Theme,
    private readonly layout: GraphLayout | null,
  ) {}

  render(
    change: {
      changeId: string;
      immutable: boolean;
      description: string;
      author?: string;
    },
    idx: number,
    width: number,
    flags: ChangeRowFlags,
  ): string {
    const graph = renderGraphPrefix(
      this.layout,
      change.changeId,
      idx,
      flags.isWorkingCopy,
      this.theme,
      change.immutable,
    );

    const { leftText, rightText } = formatChangeRow(this.theme, {
      isImmutable: change.immutable,
      isSelected: flags.isMarked,
      isFocused: flags.isFocused,
      isMoving: false,
      bookmarks: [],
      description: change.description,
    });

    return this.assembleRow(graph, leftText, rightText, width, flags);
  }

  renderWithBookmarks(
    change: {
      changeId: string;
      immutable: boolean;
      description: string;
      author?: string;
    },
    idx: number,
    width: number,
    flags: ChangeRowFlags,
    bookmarks: string[],
  ): string {
    const graph = renderGraphPrefix(
      this.layout,
      change.changeId,
      idx,
      flags.isWorkingCopy,
      this.theme,
      change.immutable,
    );

    const { leftText, rightText } = formatChangeRow(this.theme, {
      isImmutable: change.immutable,
      isSelected: flags.isMarked,
      isFocused: flags.isFocused,
      isMoving: false,
      bookmarks,
      description: change.description,
    });

    return this.assembleRow(graph, leftText, rightText, width, flags);
  }

  private assembleRow(
    graphPrefix: string,
    leftText: string,
    rightText: string,
    width: number,
    flags: { isFocused: boolean; isMarked: boolean },
  ): string {
    return assembleChangeRow(graphPrefix, leftText, rightText, width, {
      theme: this.theme,
      isFocused: flags.isFocused,
      isMarked: flags.isMarked,
    });
  }
}
