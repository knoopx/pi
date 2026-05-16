import { describe, it, expect } from "vitest";
import { createMockChange } from "../../test/utils";
import {
  renderSnapshot,
  defaultMockChange,
  setMockChanges,
} from "./test-utils";

describe("file list states", () => {
  it("then renders no files message for empty change", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "empty",
          description: "empty commit",
          author: "Alice",
          parentIds: [],
          empty: true,
        }),
      ]);
      state.files = [];
    });
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });

  it("then renders file list with status icons", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "multi",
          description: "multiple files",
          author: "Bob",
          parentIds: [],
        }),
      ]);
      state.files = [
        { status: "A", path: "src/new.tsx", insertions: 50, deletions: 0 },
        {
          status: "M",
          path: "src/existing.tsx",
          insertions: 3,
          deletions: 1,
        },
        {
          status: "D",
          path: "src/removed.tsx",
          insertions: 0,
          deletions: 10,
        },
      ];
      state.selectionState.fileIndex = 0;
    });
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });

  it("then renders conflicted files with warning icon", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [defaultMockChange()]);
      state.files = [
        {
          status: "M",
          path: "another-conflict.ts",
          insertions: 0,
          deletions: 0,
          conflicted: true,
        },
        {
          status: "M",
          path: "conflict.ts",
          insertions: 0,
          deletions: 0,
          conflicted: true,
        },
        { status: "A", path: "new.ts", insertions: 0, deletions: 0 },
        { status: "M", path: "mod.ts", insertions: 0, deletions: 0 },
      ];
      state.selectionState.fileIndex = 0;
    });
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });

  it("then renders selected file with different index", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [defaultMockChange()]);
      state.files = [
        { status: "A", path: "src/a.tsx", insertions: 5, deletions: 0 },
        { status: "M", path: "src/b.tsx", insertions: 10, deletions: 2 },
        { status: "M", path: "src/c.tsx", insertions: 3, deletions: 1 },
      ];
      state.selectionState.fileIndex = 2;
    });
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });
});
