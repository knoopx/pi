import type { ExpectStatic } from "vitest";
import type { ChangesState } from "./state";
import type { Renderer } from "./renderer";
import { calculateGraphLayout } from "../../lib/graph";
import { buildGraphInput } from "./types";
import {
  TestTerminal,
  createMockChange,
  createMockTheme,
} from "../../lib/test-utils";
export function expectDefaultSelection(
  state: ChangesState,
  expect: ExpectStatic,
) {
  expect(state.selectionState.selectedIndex).toBe(0);
  expect(state.selectionState.fileIndex).toBe(0);
  expect(state.selectionState.diffScroll).toBe(0);
}
function buildGraphLayout(
  changes: { changeId: string; parentIds?: string[] }[],
  currentChangeId: string | null,
): ReturnType<typeof calculateGraphLayout> | null {
  if (changes.length === 0) return null;
  return calculateGraphLayout(buildGraphInput(changes, currentChangeId));
}
export function featureBookmarkChange() {
  return createMockChange({
    changeId: "abc",
    description: "feat(ide): add split panel preview for file explorer",
    author: "knoopx",
    parentIds: [],
  });
}
export function defaultMockChange() {
  return createMockChange({
    changeId: "a",
    description:
      "feat(ide): add split panel preview for file explorer component",
    author: "knoopx",
    parentIds: [],
  });
}
export function wcPrevChanges(authorPrev = "knoopx") {
  return [
    createMockChange({
      changeId: "wc",
      description: "feat(ide): WIP integrate pi-tui component architecture",
      author: "knoopx",
      parentIds: ["prev"],
    }),
    createMockChange({
      changeId: "prev",
      description: "refactor(ide): simplify component rendering pipeline",
      author: authorPrev,
      parentIds: [],
    }),
  ];
}
export function setMockChanges(
  state: ChangesState,
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

export const loadingStateConfig: StateConfig = (state) => {
  state.loadingState.loading = true;
};

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
  return renderer.render(width, "");
}
