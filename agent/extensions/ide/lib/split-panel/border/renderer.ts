import type { Theme } from "@earendil-works/pi-coding-agent";
import type {
  SplitPanelConfig,
  SplitPanelDimensions,
  SplitPanelRows,
} from "../layout";
import {
  renderTopBorder,
  renderTitleRow,
  renderSeparatorRow,
  renderBottomBorder,
} from "./rows";
import { renderPanelContent } from "./body";

function renderHeader(
  theme: Theme,
  config: SplitPanelConfig,
  dims: SplitPanelDimensions,
): string[] {
  const { leftW, rightW } = dims;
  return [
    renderTopBorder({
      leftW,
      rightW,
      leftFocus: config.leftFocus,
      rightFocus: config.rightFocus,
      theme,
    }),
    renderTitleRow({
      leftTitle: config.leftTitle,
      rightTitle: config.rightTopTitle ?? config.rightTitle,
      leftW,
      rightW,
      leftFocus: config.leftFocus,
      rightFocus: config.rightFocus,
      theme,
    }),
    renderSeparatorRow({
      leftW,
      rightW,
      leftFocus: config.leftFocus,
      rightFocus: config.rightFocus,
      theme,
    }),
  ];
}

export function renderSplitPanel(
  theme: Theme,
  config: SplitPanelConfig,
  dims: SplitPanelDimensions,
  rows: SplitPanelRows,
): string[] {
  const header = renderHeader(theme, config, dims);
  const content = renderPanelContent(theme, config, dims, rows);
  const bottom = renderBottomBorder({
    leftW: dims.leftW,
    rightW: dims.rightW,
    helpText: config.helpText,
    leftFocus: config.leftFocus,
    rightFocus: config.rightFocus,
    theme,
  });

  return [...header, ...content, ...bottom];
}
