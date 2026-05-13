import type { Theme } from "@earendil-works/pi-coding-agent";

export type BorderColor = "border" | "borderAccent";

export interface PanelRowArgs {
  leftContent: string;
  rightContent: string;
  leftW: number;
  rightW: number;
  lb: BorderColor;
  rb: BorderColor;
  mb: BorderColor;
  border: (color: BorderColor, s: string) => string;
}

export interface BorderRowArgs {
  leftColor: BorderColor;
  middleColor: BorderColor;
  rightColor: BorderColor;
  leftStart: string;
  leftContent: string;
  middle: string;
  rightContent: string;
  rightEnd: string;
  border: (color: BorderColor, s: string) => string;
}

export interface FocusedRowArgs {
  leftStart: string;
  leftContent: string;
  middle: string;
  rightContent: string;
  rightEnd: string;
}

export interface PanelRenderCtx {
  leftRows: string[];
  leftW: number;
  rightW: number;
  lb: BorderColor;
  rb: BorderColor;
  mb: BorderColor;
  border: (color: BorderColor, s: string) => string;
}

export interface TopBorderArgs {
  leftW: number;
  rightW: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}

export interface TitleRowArgs {
  leftTitle: string;
  rightTitle: string;
  leftW: number;
  rightW: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}

export interface SeparatorRowArgs {
  leftW: number;
  rightW: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}

export interface BottomBorderArgs {
  leftW: number;
  rightW: number;
  helpText: string;
  leftFocus: boolean;
  rightFocus: boolean | undefined;
  theme: Theme;
}

export interface SplitRightPanelArgs {
  leftRows: string[];
  rightTopRows: string[];
  rightBottomRows: string[];
  leftW: number;
  rightW: number;
  rightTopH: number;
  rightBottomH: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  rightBottomTitle: string;
  theme: Theme;
}

export interface SimplePanelArgs {
  leftRows: string[];
  rightRows: string[];
  leftW: number;
  rightW: number;
  contentH: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}
