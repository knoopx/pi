import type { ListPickerItem } from "./types";

export function computeNewIndex(
  current: number,
  maxIndex: number,
  direction: "up" | "down" | "pageUp" | "pageDown",
  pageOffset: number,
): number {
  switch (direction) {
    case "up":
      return Math.max(0, current - 1);
    case "pageUp":
      return Math.max(0, current - pageOffset);
    case "pageDown":
      return Math.min(maxIndex, current + pageOffset);
    default:
      return Math.min(maxIndex, current + 1);
  }
}
