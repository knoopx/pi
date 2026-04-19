import { describe, it, expect } from "vitest";
import {
  createMockChange,
  renderSnapshot,
  defaultMockChange,
  setMockChanges,
} from "./test-helpers";

describe("loading state", () => {
  it("then renders loading indicator", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      state.loadingState.loading = true;
    });
    expect(visibleLines).toMatchSnapshot();
  });
});

describe("focus switching", () => {
  it("then renders right focus indicator when focused on files", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [defaultMockChange()]);
      state.files = [
        { status: "A", path: "src/main.tsx", insertions: 10, deletions: 0 },
      ];
      state.selectionState.focus = "right";
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders left focus indicator when focused on changes", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [defaultMockChange()]);
      state.selectionState.focus = "left";
    });
    expect(visibleLines).toMatchSnapshot();
  });
});

describe("move mode", () => {
  it("then renders move indicator on cursor change", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "a",
          description: "change a",
          author: "Alice",
          parentIds: [],
        }),
        createMockChange({
          changeId: "b",
          description: "change b",
          author: "Bob",
          parentIds: ["a"],
        }),
      ]);
      state.mode = "move";
      state.moveOriginalIndex = 1;
    });
    expect(visibleLines).toMatchSnapshot();
  });
});

describe("ANSI styling", () => {
  it("then includes selected background on marked changes", async () => {
    const lines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "x",
          description: "marked change",
          author: "Alice",
          parentIds: [],
        }),
      ]);
      state.selectedChangeIds.add("x");
    });
    const firstRow = lines[3];
    expect(firstRow).toContain("\x1b[48;2;50;36;93m");
  });

  it("then includes dim styling on immutable changes", async () => {
    const lines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "imm",
          description: "immutable commit",
          author: "Alice",
          immutable: true,
          parentIds: [],
        }),
      ]);
    });
    const firstRow = lines[3];
    expect(firstRow).toContain("\x1b[38;2;76;62;118m");
  });

  it("then includes accent styling on working copy", async () => {
    const lines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "wc",
          description: "work in progress",
          author: "Alice",
          parentIds: [],
        }),
      ]);
      state.currentChangeId = "wc";
    });
    const firstRow = lines[3];
    expect(firstRow).toContain("\x1b[38;2;250;208;0m");
  });
});
