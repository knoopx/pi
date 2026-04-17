import { describe, it, expect } from "vitest";
import { TestTerminal, createMockChange, stripAnsi } from "../test-utils";
import { calculateGraphLayout } from "../graph";
import { buildGraphInput } from "./types";
import { Navigation } from "./navigation";
import { createMockTheme } from "../test-utils";

/** Shared Navigation stub to avoid repeated construction. */
function makeNav(state: any): Navigation {
  return new Navigation(
    state,
    { requestRender: () => {} },
    { onChangeSelected: async () => {} },
  );
}

async function renderSnapshot(
  width: number,
  configure: (state: any) => void,
): Promise<string[]> {
  const { Renderer } = await import("./renderer");
  const theme = createMockTheme();
  const terminal = new TestTerminal(width, 30);
  const state = new (await import("./state")).ChangesState();
  configure(state);
  if (state.changes.length > 0) {
    state.graphLayout ??= calculateGraphLayout(
      buildGraphInput(
        state.changes.map((c: any) => ({
          changeId: c.changeId,
          parentIds: c.parentIds,
        })),
        state.currentChangeId,
      ),
    );
  } else {
    state.graphLayout = null;
  }
  const renderer = new Renderer(
    state,
    { terminal, requestRender: () => {} },
    theme,
  );
  return renderer.render(width, "");
}

function makeChanges(count: number, startDesc = 0) {
  return Array.from({ length: count }, (_, i) =>
    createMockChange({
      changeId: `c${i}`,
      description: `change ${startDesc + i}`,
      author: "Alice",
      parentIds: i > 0 ? [`c${i - 1}`] : [],
    }),
  );
}

/** Default state setup for move-mode tests. */
function setDefaultMoveState(state: any, count = 5, selectedIndex = 0) {
  state.changes = makeChanges(count);
  state.selectedChange = state.changes[selectedIndex];
  state.currentChangeId = null;
  state.files = [];
  state.diffContent = [];
  state.selectionState.focus = "left";
}

/** Options for move-mode state setup. */
interface MoveModeOptions {
  count?: number;
  selectedIndex?: number;
  focus?: "left" | "right";
  custom?: (state: any) => void;
  direction?: "up" | "down";
}

/** Build a complete move-mode state setup with defaults and optional navigation. */
function setupMoveMode(opts: MoveModeOptions & { changes?: any[] } = {}) {
  const count = opts.count ?? 5;
  const selectedIndex = opts.selectedIndex ?? 0;
  const changes = opts.changes ?? makeChanges(count);
  return (state: any) => {
    state.changes = changes;
    state.selectionState.selectedIndex = selectedIndex;
    state.selectedChange = state.changes[selectedIndex];
    state.currentChangeId = null;
    state.files = [];
    state.diffContent = [];
    state.selectionState.focus = opts.focus ?? "left";
    if (opts.custom) opts.custom(state);
    state.mode = "move";
    state.moveOriginalIndex = selectedIndex;
    if (opts.direction) {
      makeNav(state).moveChange(opts.direction);
    }
  };
}

describe("changes/move-mode rendering", () => {
  describe("enter move mode", () => {
    it("then renders with move indicator on cursor change", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 1 }),
      );
      expect(visibleLines).toMatchSnapshot();
    });

    it("then renders move indicator with bookmarks on cursor change", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          count: 3,
          custom: (state) => state.bookmarksByChange.set("c0", ["main"]),
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move change down", () => {
    it("then swaps and moves cursor to new position", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 1, direction: "down" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });

    it("then renders at bottom of list when moved to last position", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 3, direction: "down" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });

    it("then renders swap with marked change", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          selectedIndex: 1,
          direction: "down",
          custom: (state) => state.selectedChangeIds.add("c2"),
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move change up", () => {
    it("then swaps and moves cursor to new position", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 3, direction: "up" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });

    it("then renders at top of list when moved to first position", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 1, direction: "up" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move at boundaries", () => {
    it("then does not move up from first position", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 0, direction: "up" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });

    it("then does not move down from last position", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 4, direction: "down" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });

    it("then does not move working copy change", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          selectedIndex: 2,
          direction: "down",
          custom: (state) => {
            state.currentChangeId = "c2";
          },
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });

    it("then does not move working copy even when cursor is on different change", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          selectedIndex: 3,
          direction: "up",
          custom: (state) => {
            state.currentChangeId = "c1";
          },
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("cancel move mode", () => {
    function cancelMove(
      opts: { index?: number; moves?: ("up" | "down")[] } = {},
    ): Promise<string[]> {
      const { index = 1, moves = ["down"] as const } = opts;
      return renderSnapshot(120, (state) => {
        state.changes = makeChanges(5);
        state.selectionState.selectedIndex = index;
        state.selectedChange = state.changes[index];
        state.currentChangeId = null;
        state.files = [];
        state.diffContent = [];
        state.selectionState.focus = "left";

        const nav = makeNav(state);
        nav.enterMoveMode();
        for (const dir of moves) nav.moveChange(dir);
        nav.cancelMoveMode();
      });
    }

    it("then restores original order and selection", async () => {
      const visibleLines = await cancelMove();
      expect(visibleLines).toMatchSnapshot();
    });

    it("then restores after multiple moves", async () => {
      const visibleLines = await cancelMove({
        index: 2,
        moves: ["down", "down"],
      });
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with multiple selections", () => {
    it("then preserves marked status through moves", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          direction: "down",
          custom: (state) => {
            state.selectedChangeIds.add("c2");
            state.selectedChangeIds.add("c4");
          },
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with narrow width", () => {
    it("then renders clipped move indicator correctly", async () => {
      const visibleLines = await renderSnapshot(
        60,
        setupMoveMode({ selectedIndex: 2, direction: "down" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with empty description", () => {
    it("then renders move indicator on change with no description", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        state.changes = [
          createMockChange({
            changeId: "a",
            description: "",
            author: "Alice",
            parentIds: [],
          }),
          createMockChange({
            changeId: "b",
            description: "has desc",
            author: "Bob",
            parentIds: ["a"],
          }),
          createMockChange({
            changeId: "c",
            description: "third",
            author: "Alice",
            parentIds: ["b"],
          }),
        ];
        state.selectionState.selectedIndex = 0;
        state.selectedChange = state.changes[0];
        state.currentChangeId = null;
        state.files = [];
        state.diffContent = [];
        state.selectionState.focus = "left";
        state.mode = "move";
        state.moveOriginalIndex = 0;

        makeNav(state).moveChange("down");
      });
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with immutable commits", () => {
    it("then renders move indicator on immutable change", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          direction: "down",
          changes: [
            createMockChange({
              changeId: "a",
              description: "immutable",
              author: "Alice",
              parentIds: [],
              immutable: true,
            }),
            createMockChange({
              changeId: "b",
              description: "mutable",
              author: "Bob",
              parentIds: ["a"],
            }),
          ],
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with focus on right pane", () => {
    it("then renders change list without left focus indicator", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          selectedIndex: 1,
          focus: "right",
          direction: "down",
          custom: (state) => {
            state.files = [
              { status: "M", path: "src/file.ts", insertions: 5, deletions: 1 },
            ];
            state.diffContent = ["line 1", "line 2"];
          },
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with filter", () => {
    it("then renders with filter name in title", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          selectedIndex: 2,
          direction: "down",
          custom: (state) => {
            state.currentFilterIndex = 1;
          },
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with files and diff", () => {
    it("then renders full split-panel with move indicator", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          selectedIndex: 1,
          direction: "down",
          custom: (state) => {
            state.files = [
              {
                status: "A",
                path: "src/new.tsx",
                insertions: 50,
                deletions: 0,
              },
              {
                status: "M",
                path: "src/existing.tsx",
                insertions: 3,
                deletions: 1,
              },
            ];
            state.selectionState.fileIndex = 0;
            state.diffContent = [
              "diff --git a/src/new.tsx b/src/new.tsx",
              "+++ b/src/new.tsx",
              "@@ -0,0 +1,50 @@",
              "+export function New() {}",
            ];
          },
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with only two changes", () => {
    it("then swaps the two changes", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({ count: 2, selectedIndex: 0, direction: "down" }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with loading state", () => {
    it("then does not show move indicator when loading", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        state.loadingState.loading = true;
      });
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with empty change list", () => {
    it("then does not crash", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        state.changes = [];
        state.selectedChange = null;
        state.currentChangeId = null;
        state.files = [];
        state.diffContent = [];
        state.selectionState.focus = "left";
        state.mode = "move";
        state.moveOriginalIndex = -1;
      });
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with graph layout", () => {
    it("then renders move indicator with graph prefix", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        state.changes = [
          createMockChange({
            changeId: "c",
            description: "third",
            author: "Alice",
            parentIds: ["b"],
          }),
          createMockChange({
            changeId: "b",
            description: "second",
            author: "Bob",
            parentIds: ["a"],
          }),
          createMockChange({
            changeId: "a",
            description: "first",
            author: "Alice",
            parentIds: [],
          }),
        ];
        state.selectionState.selectedIndex = 1;
        state.selectedChange = state.changes[1];
        state.currentChangeId = null;
        state.files = [];
        state.diffContent = [];
        state.selectionState.focus = "left";
        state.mode = "move";
        state.moveOriginalIndex = 1;

        makeNav(state).moveChange("down");
      });
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with author column", () => {
    it("then renders move indicator with author aligned", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          direction: "down",
          changes: [
            createMockChange({
              changeId: "a",
              description: "first",
              author: "Alice Smith",
              parentIds: [],
            }),
            createMockChange({
              changeId: "b",
              description: "second",
              author: "Bob Jones",
              parentIds: ["a"],
            }),
          ],
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode with no author", () => {
    it("then renders move indicator without author column", async () => {
      const visibleLines = await renderSnapshot(
        120,
        setupMoveMode({
          direction: "down",
          changes: [
            createMockChange({
              changeId: "a",
              description: "first",
              author: "",
              parentIds: [],
            }),
            createMockChange({
              changeId: "b",
              description: "second",
              author: "",
              parentIds: ["a"],
            }),
          ],
        }),
      );
      expect(visibleLines).toMatchSnapshot();
    });
  });

  describe("move mode raw ANSI output", () => {
    it("then includes warning color on move indicator", async () => {
      const rawLines = await renderSnapshot(
        120,
        setupMoveMode({ selectedIndex: 2, direction: "down" }),
      );

      const changeRows = rawLines.slice(3, 8);
      const hasWarning = changeRows.some((line) => line.includes("[warning:"));
      expect(hasWarning).toBe(true);
    });
  });
});
