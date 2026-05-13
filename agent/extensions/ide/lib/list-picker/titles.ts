import type { TitleContext, ListPickerItem } from "./types";
import { truncateAnsi } from "../../../../shared/format/ansi-text";

export function buildPickerTitles<T extends ListPickerItem>(
  ctx: TitleContext<T>,
): { leftTitle: string; rightTitle: string } {
  const {
    config,
    searchQuery,
    focusedItem,
    filteredCount,
    totalCount,
    leftW,
    rightW,
  } = ctx;
  const titleText =
    typeof config.title === "function" ? config.title() : config.title;
  const searchDisplay = searchQuery
    ? ` Search: ${truncateAnsi(searchQuery, leftW - 10)}`
    : ` ${titleText}`;
  const itemCount = `(${String(filteredCount)}/${String(totalCount)})`;
  const leftTitle = truncateAnsi(`${searchDisplay} ${itemCount}`, leftW);
  const previewTitleText = focusedItem
    ? (config.previewTitle?.(focusedItem) ?? focusedItem.path)
    : undefined;
  const rightTitle = previewTitleText
    ? ` ${truncateAnsi(previewTitleText, rightW - 2)}`
    : " Source Preview";

  return { leftTitle, rightTitle };
}
