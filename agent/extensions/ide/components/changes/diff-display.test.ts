import { describe, it, expect } from "vitest";
import {
  createMockChange,
  renderSnapshot,
  renderRawSnapshot,
  defaultMockChange,
  featureBookmarkChange,
  setMockChanges,
} from "./test-helpers";

describe("diff states", () => {
    it("then renders no content for empty diff", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        setMockChanges(state, [defaultMockChange()]);
        state.diffContent = [];
      });
      expect(visibleLines).toMatchSnapshot();
    });

    it("then renders diff content with lines", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        setMockChanges(state, [defaultMockChange()]);
        state.files = [
          { status: "M", path: "src/file.ts", insertions: 5, deletions: 2 },
        ];
        state.selectionState.fileIndex = 0;
        state.diffContent = [
          "diff --git a/src/file.ts b/src/file.ts",
          "index abc123..def456 100644",
          "--- a/src/file.ts",
          "+++ b/src/file.ts",
          "@@ -1,3 +1,5 @@",
          " line 1",
          "+added line",
          " line 2",
          "-removed line",
          "+another added",
          " line 3",
        ];
      });
      expect(visibleLines).toMatchSnapshot();
    });

    it("then renders diff with scroll offset", async () => {
      const visibleLines = await renderSnapshot(120, (state) => {
        setMockChanges(state, [defaultMockChange()]);
        state.files = [
          { status: "M", path: "src/file.ts", insertions: 10, deletions: 5 },
        ];
        state.selectionState.fileIndex = 0;
        state.selectionState.diffScroll = 3;
        state.diffContent = [
          "line 1",
          "line 2",
          "line 3",
          "line 4",
          "line 5",
          "line 6",
          "line 7",
        ];
      });
      expect(visibleLines).toMatchSnapshot();
    });
  })