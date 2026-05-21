import type { TitleContext, ListPickerItem } from "./types";
import { truncateAnsi } from "../../../../shared/format/ansi-text";

function buildLeftTitle<T extends ListPickerItem>(
  ctx: TitleContext<T>,
): string {
  const titleText =
    typeof ctx.config.title === "function"
      ? ctx.config.title()
      : ctx.config.title;
  const searchDisplay = ctx.searchQuery
    ? ` Search: ${truncateAnsi(ctx.searchQuery, ctx.leftW - 10)}`
    : ` ${titleText}`;
  const itemCount = `(${String(ctx.filteredCount)}/${String(ctx.totalCount)})`;
  return truncateAnsi(`${searchDisplay} ${itemCount}`, ctx.leftW);
}

function resolvePreviewTitle<T extends ListPickerItem>(
  config: TitleContext<T>["config"],
  item: T,
): string {
  if (config.previewTitle) {
    const title = config.previewTitle(item);
    if (title) return title;
  }
  return item.path ?? "";
}

function buildRightTitle<T extends ListPickerItem>(
  ctx: TitleContext<T>,
): string {
  if (!ctx.focusedItem) return " Source Preview";
  const title = resolvePreviewTitle(ctx.config, ctx.focusedItem);
  return ` ${truncateAnsi(title, ctx.rightW - 2)}`;
}

export function buildPickerTitles<T extends ListPickerItem>(
  ctx: TitleContext<T>,
): { leftTitle: string; rightTitle: string } {
  return {
    leftTitle: buildLeftTitle(ctx),
    rightTitle: buildRightTitle(ctx),
  };
}
