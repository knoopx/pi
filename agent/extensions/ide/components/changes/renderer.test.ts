import { describe, it, expect } from "vitest";
import {
  createMockChange,
  renderSnapshot,
  renderRawSnapshot,
  defaultMockChange,
  featureBookmarkChange,
  setMockChanges,
} from "./test-helpers";

describe("loading state", () => {
    it("then renders loading indicator", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        state.loadingState.loading = true;
      });
      expect(visibleLines).toMatchSnapshot();
    });
  })

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
  })

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
  })