import { describe, it, expect } from "vitest";
import { createMockChange } from "../../lib/test-utils";
import { expectDefaultSelection } from "./test-helpers";

// ─── Tests ────────────────────────────────────────────────────────────────

describe("changes/state", () => {
  describe("given a new ChangesState instance", () => {
    it("then selectionState has correct defaults", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      expectDefaultSelection(state, expect);
      expect(state.selectionState.focus).toBe("left");
    });

    it("then loadingState has correct defaults", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      expect(state.loadingState.loading).toBe(false);
    });

    it("then data collections are empty", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      expect(state.changes).toEqual([]);
      expect(state.selectedChange).toBeNull();
      expect(state.currentChangeId).toBeNull();
      expect(state.files).toEqual([]);
      expect(state.diffContent).toEqual([]);
      expect(state.bookmarksByChange.size).toBe(0);
      expect(state.selectedChangeIds.size).toBe(0);
      expect(state.changeCache.size).toBe(0);
      expect(state.graphLayout).toBeNull();
      expect(state.currentFilterIndex).toBe(0);
      expect(state.rightListHeight).toBe(0);
      expect(state.mode).toBe("normal");
      expect(state.moveOriginalIndex).toBe(-1);
      expect(state.moveOriginalChanges).toEqual([]);
    });
  });

  describe("given a changes list with items", () => {
    it("then selectedChange and selectedIndex are updated", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      const change1 = createMockChange({
        changeId: "abc123",
        commitId: "def456",
        description: "feat: add login",
        author: "Alice",
        timestamp: "2024-01-01 10:00",
      });
      const change2 = createMockChange({
        changeId: "ghi789",
        commitId: "jkl012",
        description: "fix: crash",
        author: "Bob",
        timestamp: "2024-01-02 11:00",
        parentIds: ["abc123"],
      });

      state.changes = [change1, change2];
      state.selectedChange = change1;
      state.selectionState.selectedIndex = 0;

      expect(state.changes.length).toBe(2);
      expect(state.selectedChange.changeId).toBe("abc123");
      expect(state.selectionState.selectedIndex).toBe(0);

      state.selectionState.selectedIndex = 1;
      state.selectedChange = state.changes[1];

      expect(state.selectionState.selectedIndex).toBe(1);
      expect(state.selectedChange.changeId).toBe("ghi789");
    });

    it("then currentChangeId is set correctly", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      state.currentChangeId = "abc123";
      expect(state.currentChangeId).toBe("abc123");

      state.currentChangeId = null;
      expect(state.currentChangeId).toBeNull();
    });

    it("then files are stored correctly", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      state.files = [
        { status: "A", path: "src/main.ts", insertions: 50, deletions: 0 },
        { status: "M", path: "README.md", insertions: 10, deletions: 2 },
      ];

      expect(state.files.length).toBe(2);
      expect(state.files[0].status).toBe("A");
      expect(state.files[0].path).toBe("src/main.ts");
      expect(state.files[1].status).toBe("M");
    });

    it("then diffContent is stored correctly", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      state.diffContent = [
        "diff --git a/file.ts b/file.ts",
        "+++ b/file.ts",
        "@@ -1,0 +1,3 @@",
        "+new line",
      ];

      expect(state.diffContent.length).toBe(4);
      expect(state.diffContent[0]).toContain("diff --git");
    });
  });

  describe("given bookmarks", () => {
    it("then bookmarksByChange stores entries", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      state.bookmarksByChange.set("abc123", ["main", "release"]);
      state.bookmarksByChange.set("ghi789", ["feature-x"]);

      expect(state.bookmarksByChange.get("abc123")).toEqual([
        "main",
        "release",
      ]);
      expect(state.bookmarksByChange.get("ghi789")).toEqual(["feature-x"]);
      expect(state.bookmarksByChange.has("nonexistent")).toBe(false);
    });

    it("then bookmarksByChange can be cleared", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      state.bookmarksByChange.set("abc123", ["main"]);
      expect(state.bookmarksByChange.size).toBe(1);

      state.bookmarksByChange.clear();
      expect(state.bookmarksByChange.size).toBe(0);
    });
  });

  describe("given selected change ids", () => {
    it("then selectedChangeIds tracks multiple selections", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      state.selectedChangeIds.add("abc123");
      state.selectedChangeIds.add("ghi789");
      state.selectedChangeIds.add("mno345");

      expect(state.selectedChangeIds.size).toBe(3);
      expect(state.selectedChangeIds.has("abc123")).toBe(true);
      expect(state.selectedChangeIds.has("ghi789")).toBe(true);
      expect(state.selectedChangeIds.has("mno345")).toBe(true);
      expect(state.selectedChangeIds.has("xyz")).toBe(false);

      state.selectedChangeIds.delete("ghi789");
      expect(state.selectedChangeIds.size).toBe(2);
    });

    it("then selectedChangeIds can be cleared", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      state.selectedChangeIds.add("abc123");
      state.selectedChangeIds.add("ghi789");

      state.selectedChangeIds.clear();
      expect(state.selectedChangeIds.size).toBe(0);
    });
  });

  describe("given graph layout", () => {
    it("then graphLayout is initially null and can be set", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      expect(state.graphLayout).toBeNull();

      // GraphLayout would normally come from calculateGraphLayout
      const mockLayout = {
        positions: new Map<string, { x: number; y: number }>(),
        edges: [],
        maxX: 0,
      };
      state.graphLayout = mockLayout;
      expect(state.graphLayout).toBe(mockLayout);
    });
  });

  describe("given change cache", () => {
    it("then changeCache stores and retrieves entries", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      const entry = { files: [], diffs: new Map() };
      entry.diffs.set("src/main.ts", ["line 1", "line 2"]);

      state.changeCache.set("abc123", entry);

      expect(state.changeCache.has("abc123")).toBe(true);
      const retrieved = state.changeCache.get("abc123");
      expect(retrieved?.files).toEqual([]);
      expect(retrieved?.diffs.has("src/main.ts")).toBe(true);

      // Replace entry
      const newEntry = {
        files: [{ status: "A", path: "x.ts", insertions: 1, deletions: 0 }],
        diffs: new Map(),
      };
      state.changeCache.set("abc123", newEntry);
      expect(state.changeCache.get("abc123")?.files.length).toBe(1);

      state.changeCache.clear();
      expect(state.changeCache.size).toBe(0);
    });
  });

  describe("given move mode state", () => {
    it("then mode starts as normal and can switch to move", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      expect(state.mode).toBe("normal");

      state.mode = "move";
      expect(state.mode).toBe("move");

      state.moveOriginalIndex = 3;
      state.moveOriginalChanges = [
        createMockChange({ changeId: "a", description: "x" }),
        createMockChange({ changeId: "b", description: "y", parentIds: ["a"] }),
      ];

      expect(state.moveOriginalIndex).toBe(3);
      expect(state.moveOriginalChanges.length).toBe(2);

      state.mode = "normal";
      state.moveOriginalIndex = -1;
      state.moveOriginalChanges = [];

      expect(state.mode).toBe("normal");
      expect(state.moveOriginalIndex).toBe(-1);
    });
  });

  describe("given list heights", () => {
    it("then rightListHeight tracks dimensions", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      expect(state.rightListHeight).toBe(0);

      state.rightListHeight = 15;

      expect(state.rightListHeight).toBe(15);
    });
  });

  describe("given loading state", () => {
    it("then loadingState can be updated", async () => {
      const { ChangesState } = await import("./state");
      const state = new ChangesState();

      expect(state.loadingState.loading).toBe(false);

      // Simulate loading started
      state.loadingState.loading = true;

      expect(state.loadingState.loading).toBe(true);

      state.loadingState.loading = false;

      expect(state.loadingState.loading).toBe(false);
    });
  });
});
