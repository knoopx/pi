import type { Theme } from "@earendil-works/pi-coding-agent";

function formatTabBar<T extends string>(
  tabOrder: readonly T[],
  tabLabels: Record<T, string>,
  activeTab: T,
  theme: Theme,
): string {
  const th = theme;
  return tabOrder
    .map((tab) => {
      const label = tabLabels[tab];
      return tab === activeTab
        ? th.fg("accent", `[${label}]`)
        : th.fg("dim", ` ${label} `);
    })
    .join("  ");
}

export { formatTabBar };
