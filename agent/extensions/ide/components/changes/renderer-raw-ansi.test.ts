import { describe, it, expect } from "vitest";
import {
  createMockChange,
  renderSnapshot,
  renderRawSnapshot,
  defaultMockChange,
  featureBookmarkChange,
  setMockChanges,
} from "./test-helpers";

describe("changes/renderer raw ANSI output", () => {
  it("then includes selected background on marked changes", async () => {
    const lines = await renderRawSnapshot(120, (state) => {
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
    expect(firstRow).toContain("[BG:selectedBg:");
  });

  it("then includes dim styling on immutable changes", async () => {
    const lines = await renderRawSnapshot(120, (state) => {
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
    expect(firstRow).toContain("[dim:");
  });

  it("then includes accent styling on working copy", async () => {
    const lines = await renderRawSnapshot(120, (state) => {
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
    expect(firstRow).toContain("[accent:");
  });
});
