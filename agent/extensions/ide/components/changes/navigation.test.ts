import { describe, it, expect } from "vitest";
import { createMockChange } from "../test-utils";
import { Navigation } from "./navigation";
import { ChangesState } from "./state";

// ─── Shared assertions ────────────────────────────────────────────────────

/** Asserts the order after moving change "b" past others (a, c, b). */
function expectMovedOrder(state: ChangesState) {
  expect(state.changes[0].changeId).toBe("a");
  expect(state.changes[1].changeId).toBe("c");
  expect(state.changes[2].changeId).toBe("b");
}

/** Asserts the original order (a, b, c) after undoing a move. */
function expectOriginalOrder(state: ChangesState) {
  expect(state.changes[0].changeId).toBe("a");
  expect(state.changes[1].changeId).toBe("b");
  expect(state.changes[2].changeId).toBe("c");
}

/** Asserts default selection state values. */
function expectDefaultSelection(state: ChangesState) {
  expect(state.selectionState.selectedIndex).toBe(0);
  expect(state.selectionState.fileIndex).toBe(0);
  expect(state.selectionState.diffScroll).toBe(0);
}

// ─── Shared test factories ────────────────────────────────────────────────

/** Creates a state with 3 changes for move-mode tests (middle selected). */
function createMoveModeState() {
  const state = new ChangesState();
  state.changes = [
    makeChange("a", "x"),
    makeChange("b", "y"),
    makeChange("c", "z"),
  ];
  state.selectedChange = state.changes[1];
  state.selectionState.selectedIndex = 1;
  return state;
}

/** Creates a state with exactly 2 changes (first selected). */
function makeTwoChangesState() {
  const state = new ChangesState();
  state.changes = [makeChange("a", "x"), makeChange("b", "y")];
  state.selectedChange = state.changes[0];
  return state;
}

/** Creates a state with 50 changes at the given start index. */
function makePagedState(startIndex: number) {
  const state = new ChangesState();
  state.changes = Array.from({ length: 50 }, (_, i) =>
    makeChange(`c${i}`, `change ${i}`),
  );
  state.selectedChange = state.changes[startIndex];
  return state;
}

// ─── Mock theme (minimal, mimics pi-coding-agent Theme) ──────────────────

function createMockTheme() {
  return {
    fg: (color: string, text: string) => `\x1b[${color}m${text}\x1b[39m`,
    bg: (color: string, text: string) => `\x1b[${color}m${text}\x1b[49m`,
    bold: (text: string) => `\x1b[1m${text}\x1b[22m`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const makeChange = (id: string, desc: string) =>
  createMockChange({
    changeId: id,
    commitId: `c${id}`,
    description: desc,
    author: "Test",
    timestamp: "2024-01-01 00:00",
  });

function makeNavigation(state: ChangesState) {
  return new Navigation(
    state,
    { requestRender: () => {} },
    {
      onChangeSelected: async (id) => {},
      onFileSelected: async (_p) => {},
    },
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("changes/navigation", () => {
  describe("given an empty change list", () => {
    it("then navigateChanges does nothing", () => {
      const state = new ChangesState();
      const nav = makeNavigation(state);
      nav.navigateChanges("down");
      expect(state.selectionState.selectedIndex).toBe(0);
      expect(state.selectedChange).toBeNull();
    });

    it("then navigateFiles does nothing", () => {
      const state = new ChangesState();
      state.selectedChange = makeChange("a", "x");
      const nav = makeNavigation(state);
      nav.navigateFiles("down");
      expect(state.selectionState.fileIndex).toBe(0);
    });
  });

  describe("given a list of changes", () => {
    it("then navigate down increments index and updates selectedChange", () => {
      const state = new ChangesState();
      state.changes = [
        makeChange("a", "first"),
        makeChange("b", "second"),
        makeChange("c", "third"),
      ];
      state.selectedChange = state.changes[0];
      const nav = makeNavigation(state);

      nav.navigateChanges("down");
      expect(state.selectionState.selectedIndex).toBe(1);
      expect(state.selectedChange!.changeId).toBe("b");

      nav.navigateChanges("down");
      expect(state.selectionState.selectedIndex).toBe(2);
      expect(state.selectedChange!.changeId).toBe("c");
    });

    it("then navigate up decrements index", () => {
      const state = new ChangesState();
      state.changes = [
        makeChange("a", "first"),
        makeChange("b", "second"),
        makeChange("c", "third"),
      ];
      state.selectedChange = state.changes[2];
      state.selectionState.selectedIndex = 2;
      const nav = makeNavigation(state);

      nav.navigateChanges("up");
      expect(state.selectionState.selectedIndex).toBe(1);
    });

    it("then pageDown jumps by ~10 items", () => {
      const state = makePagedState(0);
      const nav = makeNavigation(state);

      nav.navigateChanges("pageDown");
      expect(state.selectionState.selectedIndex).toBe(10);

      nav.navigateChanges("pageDown");
      expect(state.selectionState.selectedIndex).toBe(20);
    });

    it("then pageUp jumps back by ~10 items", () => {
      const state = makePagedState(20);
      state.selectionState.selectedIndex = 20;
      const nav = makeNavigation(state);

      nav.navigateChanges("pageUp");
      expect(state.selectionState.selectedIndex).toBe(10);
    });

    it("then clamps to bounds on navigation", () => {
      const state = makeTwoChangesState();
      const nav = makeNavigation(state);

      // Already at start, up stays
      nav.navigateChanges("up");
      expect(state.selectionState.selectedIndex).toBe(0);

      // At end, down stays
      state.selectionState.selectedIndex = 1;
      nav.navigateChanges("down");
      expect(state.selectionState.selectedIndex).toBe(1);
    });

    it("then switchFocus toggles between left and right", () => {
      const state = new ChangesState();
      state.selectedChange = makeChange("a", "x");
      const nav = makeNavigation(state);

      expect(state.selectionState.focus).toBe("left");
      nav.switchFocus();
      expect(state.selectionState.focus).toBe("right");
      nav.switchFocus();
      expect(state.selectionState.focus).toBe("left");
    });

    it("then toggleSelection adds and removes from selectedChangeIds", () => {
      const state = makeTwoChangesState();
      const nav = makeNavigation(state);

      expect(state.selectedChangeIds.size).toBe(0);
      nav.toggleSelection();
      expect(state.selectedChangeIds.has("a")).toBe(true);
      nav.toggleSelection();
      expect(state.selectedChangeIds.has("a")).toBe(false);
    });

    it("then toggleSelection does nothing when no change is selected", () => {
      const state = new ChangesState();
      state.changes = [makeChange("a", "x")];
      // Don't set selectedChange
      const nav = makeNavigation(state);
      nav.toggleSelection();
      expect(state.selectedChangeIds.size).toBe(0);
    });

    it("then cycleFilter advances and wraps around", () => {
      const state = new ChangesState();
      const nav = makeNavigation(state);

      expect(state.currentFilterIndex).toBe(0);
      nav.cycleFilter(1, 4);
      expect(state.currentFilterIndex).toBe(1);
      nav.cycleFilter(1, 4);
      expect(state.currentFilterIndex).toBe(2);
      nav.cycleFilter(-1, 4);
      expect(state.currentFilterIndex).toBe(1);

      // Wrap from last to first
      state.currentFilterIndex = 3;
      nav.cycleFilter(1, 4);
      expect(state.currentFilterIndex).toBe(0);

      // Wrap from first backwards
      state.currentFilterIndex = 0;
      nav.cycleFilter(-1, 4);
      expect(state.currentFilterIndex).toBe(3);
    });

    it("then cycleFilter resets selection indices", () => {
      const state = new ChangesState();
      state.changes = [makeChange("a", "x")];
      state.selectedChange = state.changes[0];
      state.selectionState.selectedIndex = 5;
      state.selectionState.fileIndex = 3;
      state.selectionState.diffScroll = 10;

      const nav = makeNavigation(state);
      nav.cycleFilter(1, 4);

      expectDefaultSelection(state);
    });

    it("then navigateFiles increments and decrements file index", () => {
      const state = new ChangesState();
      state.selectedChange = makeChange("a", "x");
      state.files = [
        { status: "A", path: "a.ts", insertions: 1, deletions: 0 },
        { status: "M", path: "b.ts", insertions: 2, deletions: 1 },
        { status: "D", path: "c.ts", insertions: 0, deletions: 3 },
      ];

      const nav = makeNavigation(state);
      nav.navigateFiles("down");
      expect(state.selectionState.fileIndex).toBe(1);

      nav.navigateFiles("down");
      expect(state.selectionState.fileIndex).toBe(2);

      // Clamped at end
      nav.navigateFiles("down");
      expect(state.selectionState.fileIndex).toBe(2);

      nav.navigateFiles("up");
      expect(state.selectionState.fileIndex).toBe(1);

      nav.navigateFiles("up");
      expect(state.selectionState.fileIndex).toBe(0);

      // Clamped at start
      nav.navigateFiles("up");
      expect(state.selectionState.fileIndex).toBe(0);
    });

    it("then scrollDiff increments and decrements diff scroll", () => {
      const state = new ChangesState();
      state.diffContent = Array.from({ length: 30 }, (_, i) => `line ${i}`);

      const nav = makeNavigation(state);
      expect(state.selectionState.diffScroll).toBe(0);

      nav.scrollDiff("down");
      expect(state.selectionState.diffScroll).toBeGreaterThan(0);

      nav.scrollDiff("up");
      expect(state.selectionState.diffScroll).toBeLessThan(10);

      // Clamped at start
      state.selectionState.diffScroll = 0;
      nav.scrollDiff("up");
      expect(state.selectionState.diffScroll).toBe(0);
    });

    it("then enterMoveMode sets mode and saves original state", () => {
      const state = createMoveModeState();
      const nav = makeNavigation(state);
      nav.enterMoveMode();

      expect(state.mode).toBe("move");
      expect(state.moveOriginalIndex).toBe(1);
    });

    it("then moveChange swaps the change and moves selection", () => {
      const state = createMoveModeState();
      const nav = makeNavigation(state);
      nav.enterMoveMode();
      nav.moveChange("down");

      expect(state.selectionState.selectedIndex).toBe(2);
      expectMovedOrder(state);

      nav.moveChange("up");
      expectOriginalOrder(state);
      expect(state.selectionState.selectedIndex).toBe(1);
    });

    it("then cancelMoveMode restores original order", () => {
      const state = createMoveModeState();
      const nav = makeNavigation(state);
      nav.enterMoveMode();
      nav.moveChange("down");
      nav.moveChange("down"); // now at end

      expect(state.mode).toBe("move");
      expect(state.changes[0].changeId).toBe("a");
      expect(state.changes[1].changeId).toBe("c");
      expect(state.changes[2].changeId).toBe("b");

      nav.cancelMoveMode();

      expect(state.mode).toBe("normal");
      expect(state.selectionState.selectedIndex).toBe(1);
      // Original order restored
      expectOriginalOrder(state);
    });

    it("then moveChange does nothing for current change", () => {
      const state = makeTwoChangesState();
      state.currentChangeId = "a";

      const nav = makeNavigation(state);
      nav.enterMoveMode();
      nav.moveChange("down");
      expect(state.changes[0].changeId).toBe("a");
      expect(state.selectionState.selectedIndex).toBe(0);
    });

    it("then moveChange respects boundaries", () => {
      const state = makeTwoChangesState();

      const nav = makeNavigation(state);
      nav.enterMoveMode();
      // Can't move up from index 0
      nav.moveChange("up");
      expect(state.selectionState.selectedIndex).toBe(0);

      // Can't move down from last index
      state.selectionState.selectedIndex = 1;
      nav.moveChange("down");
      expect(state.selectionState.selectedIndex).toBe(1);
    });
  });
});
