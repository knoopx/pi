import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { GraphLayout } from "../graph";
import { formatChangeRow } from "../changes/formatting";
import { CachedRow } from "./utils";
import { renderGraphPrefix, assembleChangeRow } from "../change-row-utils";
import { ensureWidth, truncateAnsi } from "../text-utils";

export interface ChangeRowFlags {
  isCursor: boolean;
  isMarked: boolean;
  isFocused: boolean;
  isWorkingCopy: boolean;
  isMoving: boolean;
}

export interface ChangeRowProps {
  change: {
    changeId: string;
    immutable: boolean;
    description: string;
    author?: string;
  };
  idx: number;
  width: number;
  flags: ChangeRowFlags;
  bookmarks: string[];
  theme: Theme;
  layout: GraphLayout | null;
}

/** A single change/commit row rendered as a pi-tui Component. */
export class ChangeRow extends CachedRow {
  private readonly props: Omit<ChangeRowProps, "width">;

  constructor(props: Omit<ChangeRowProps, "width">) {
    super();
    this.props = props;
  }

  protected renderLine(width: number): string {
    const graph = renderGraphPrefix(
      this.props.layout,
      this.props.change.changeId,
      this.props.idx,
      this.props.flags.isWorkingCopy,
      this.props.theme,
      this.props.change.immutable,
    );

    const { leftText, rightText } = formatChangeRow(this.props.theme, {
      isImmutable: this.props.change.immutable,
      isSelected: this.props.flags.isMarked,
      isFocused: this.props.flags.isFocused,
      isMoving: this.props.flags.isMoving,
      bookmarks: this.props.bookmarks,
      description: this.props.change.description,
    });

    return this.assembleRow(
      graph,
      leftText,
      rightText,
      width,
      this.props.flags,
    );
  }

  private assembleRow(
    graphPrefix: string,
    leftText: string,
    rightText: string,
    width: number,
    flags: { isFocused: boolean; isMarked: boolean },
  ): string {
    return assembleChangeRow(graphPrefix, leftText, rightText, width, {
      theme: this.props.theme,
      isFocused: flags.isFocused,
      isMarked: flags.isMarked,
      padLeft: true,
    });
  }
}

/** Empty change row for "No changes" state. */
export class EmptyChangeRow extends CachedRow {
  constructor(
    private readonly message: string,
    private readonly theme: Theme,
  ) {
    super();
  }

  protected renderLine(width: number): string {
    const text = this.theme.fg("dim", ` ${this.message}`);
    return ensureWidth(truncateAnsi(text, width), width);
  }
}
