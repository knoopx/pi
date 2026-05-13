import type { Theme } from "@earendil-works/pi-coding-agent";
import { ensureWidth } from "../../../../shared/format/ansi-text";
import { getVisibleItems } from "../formatting/text";

interface ListPaneRendererOptions<T> {
  items: T[];
  selectedIndex: number;
  height: number;
  width: number;
  theme: Theme;
  emptyMessage: string;
  createRow: (
    item: T,
    index: number,
  ) => { render: (width: number) => string[] };
}

export function renderListPane<T>(
  options: ListPaneRendererOptions<T>,
): string[] {
  if (options.items.length === 0) {
    return [
      ensureWidth(options.theme.fg("dim", options.emptyMessage), options.width),
    ];
  }

  const visibleItems = getVisibleItems(
    options.items,
    options.selectedIndex,
    options.height,
  );
  const rows: string[] = [];

  for (const { item, index: idx } of visibleItems) {
    const row = options.createRow(item, idx);
    rows.push(row.render(options.width)[0]);
  }

  return rows;
}
