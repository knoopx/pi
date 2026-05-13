export function calculateNavigationTarget(
  currentIndex: number,
  maxIndex: number,
  direction: "up" | "down" | "pageUp" | "pageDown",
  pageOffset: number,
): number {
  const delta =
    direction === "up"
      ? -1
      : direction === "down"
        ? 1
        : direction === "pageUp"
          ? -pageOffset
          : pageOffset;
  return Math.max(0, Math.min(maxIndex, currentIndex + delta));
}
