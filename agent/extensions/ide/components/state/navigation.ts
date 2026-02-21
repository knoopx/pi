import { buildHelpText } from "../text-utils";

/** Generic navigation handler for list components */
export function createNavigationHandler<T>(
  items: T[],
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  onSelectionChange: (item: T | null) => void,
  invalidate: () => void,
  requestRender: () => void,
): (direction: "up" | "down") => void {
  return (direction: "up" | "down") => {
    const maxIndex = items.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, state.selectedIndex - 1)
        : Math.min(maxIndex, state.selectedIndex + 1);

    if (newIndex !== state.selectedIndex) {
      state.selectedIndex = newIndex;
      onSelectionChange(items[newIndex] || null);
      invalidate();
      requestRender();
    }
  };
}

/** Generic file navigation handler */
export function createFileNavigationHandler<T extends { path?: string }>(
  files: T[],
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  onFileChange: (file: T | null) => void,
  invalidate: () => void,
  requestRender: () => void,
): (direction: "up" | "down") => void {
  return (direction: "up" | "down") => {
    const maxIndex = files.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, state.fileIndex - 1)
        : Math.min(maxIndex, state.fileIndex + 1);

    if (newIndex !== state.fileIndex) {
      state.fileIndex = newIndex;
      onFileChange(files[newIndex] || null);
      invalidate();
      requestRender();
    }
  };
}

/** Generic diff scrolling handler */
export function createDiffScrollHandler(
  diffContent: string[],
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  terminalRows: number,
  _cachedWidth: number,
  invalidate: () => void,
  requestRender: () => void,
): (direction: "up" | "down") => void {
  return (direction: "up" | "down") => {
    const maxScroll = Math.max(0, diffContent.length - terminalRows + 5);
    const newScroll =
      direction === "up"
        ? Math.max(0, state.diffScroll - 1)
        : Math.min(maxScroll, state.diffScroll + 1);
    state.diffScroll = newScroll;
    invalidate();
    requestRender();
  };
}

/** Generic focus switching handler */
export function createFocusHandler(
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  invalidate: () => void,
  requestRender: () => void,
): () => void {
  return () => {
    state.focus = state.focus === "left" ? "right" : "left";
    invalidate();
    requestRender();
  };
}

/** Generic help text builder for navigation */
export function buildNavigationHelp(
  focus: "left" | "right",
  leftActions: string[] = [],
  rightActions: string[] = [],
): string {
  const baseHelp = ["tab ↑↓ nav"];

  if (focus === "left") {
    return buildHelpText(...baseHelp, ...leftActions);
  } else {
    return buildHelpText(...baseHelp, ...rightActions);
  }
}

/** Base configuration for split panel dimensions calculation */
export function createBaseDimensionsConfig(
  leftFocus: boolean,
  rightFocus = false,
): {
  leftTitle: string;
  rightTitle: string;
  helpText: string;
  leftFocus: boolean;
  rightFocus: boolean;
} {
  return {
    leftTitle: "",
    rightTitle: "",
    helpText: "",
    leftFocus,
    rightFocus,
  };
}
