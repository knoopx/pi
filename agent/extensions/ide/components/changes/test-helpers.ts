import type { ChangesState } from "./state";
import type { Renderer } from "./renderer";
import { calculateGraphLayout } from "../graph";
import { buildGraphInput } from "./types";
import {
  TestTerminal,
  createMockChange,
  createMockTheme,
  stripAnsi,
} from "../test-utils";

export { createMockChange } from "../test-utils";

/** Build graphLayout from changes + currentChangeId */
function buildGraphLayout(
  changes: { changeId: string; parentIds?: string[] }[],
  currentChangeId: string | null,
): ReturnType<typeof calculateGraphLayout> | null {
  if (changes.length === 0) return null;
  return calculateGraphLayout(buildGraphInput(changes, currentChangeId));
}

/** Mock change for bookmark-related tests. */
export function featureBookmarkChange() {
  return createMockChange({
    changeId: "abc",
    description: "feature commit",
    author: "Alice",
    parentIds: [],
  });
}

/** Default mock change used across rendering tests. */
export function defaultMockChange() {
  return createMockChange({
    changeId: "a",
    description: "change a",
    author: "Alice",
    parentIds: [],
  });
}

/** Helper to configure a state with changes and empty files/diff. */
export function setMockChanges(
  state: Pick<
    ChangesState,
    "changes" | "selectedChange" | "currentChangeId" | "files" | "diffContent"
  > & {
    selectionState?: any;
    bookmarksByChange?: Map<string, string[]>;
    graphLayout?: unknown;
    loadingState?: any;
    mode?: string;
    moveOriginalIndex?: number;
    selectedChangeIds?: Set<string>;
    currentFilterIndex?: number;
  },
  changes: ReturnType<typeof createMockChange>[],
  selectedIdx = 0,
) {
  state.changes = changes;
  state.selectedChange = state.changes[selectedIdx];
  state.currentChangeId = null;
  state.files = [];
  state.diffContent = [];
}

type StateConfig = (state: ChangesState) => void;

/** Set up a test terminal and configure state for rendering tests. */
async function createRendererForTest(
  width: number,
  configure: StateConfig,
): Promise<Renderer> {
  const { Renderer } = await import("./renderer");
  const theme = createMockTheme();
  const terminal = new TestTerminal(width, width <= 60 ? 20 : 30);
  const state = new (await import("./state")).ChangesState();
  configure(state);
  if (state.changes.length > 0) {
    state.graphLayout ??= buildGraphLayout(
      state.changes,
      state.currentChangeId,
    );
  } else {
    state.graphLayout = null;
  }
  return new Renderer(state, { terminal, requestRender: () => {} }, theme);
}

export async function renderSnapshot(
  width: number,
  configure: StateConfig,
): Promise<string[]> {
  const renderer = await createRendererForTest(width, configure);
  return renderer.render(width, "").map(stripAnsi);
}

/** Render without stripping ANSI — for raw styling assertions. */
export async function renderRawSnapshot(
  width: number,
  configure: StateConfig,
): Promise<string[]> {
  const renderer = await createRendererForTest(width, configure);
  return renderer.render(width, "");
}
