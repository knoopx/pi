import { describe, it, expect } from "vitest";
import {
  createMockChange,
  renderSnapshot,
  renderRawSnapshot,
  defaultMockChange,
  featureBookmarkChange,
  setMockChanges,
} from "./test-helpers";

describe("linear chain graph renders with tree structure", () => {
  it("then renders tree structure for chained commits", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "c",
          commitId: "c-commit",
          description: "feat: add feature C",
          author: "Alice",
          parentIds: ["b"],
        }),
        createMockChange({
          changeId: "b",
          commitId: "b-commit",
          description: "feat: add feature B",
          author: "Alice",
          parentIds: ["a"],
        }),
        createMockChange({
          changeId: "a",
          commitId: "a-commit",
          description: "feat: initial feature A",
          author: "Alice",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders working copy icon for current change", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(
        state,
        [
          createMockChange({
            changeId: "wc",
            description: "work in progress",
            author: "Alice",
            parentIds: ["prev"],
          }),
          createMockChange({
            changeId: "prev",
            description: "previous commit",
            author: "Alice",
            parentIds: [],
          }),
        ],
        0,
      );
      state.currentChangeId = "wc"; // wc IS the current working copy
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders merge graph with branch symbols", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "tip",
          description: "merge feature into main",
          author: "Alice",
          parentIds: ["feature", "main"],
        }),
        createMockChange({
          changeId: "feature",
          description: "feat: add new feature",
          author: "Bob",
          parentIds: ["shared"],
        }),
        createMockChange({
          changeId: "main",
          description: "fix: critical fix",
          author: "Alice",
          parentIds: ["shared"],
        }),
        createMockChange({
          changeId: "shared",
          description: "shared base commit",
          author: "Alice",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders bookmarks in change rows", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "abc",
          description: "feat: main feature",
          author: "Alice",
          parentIds: [],
        }),
      ]);
      state.bookmarksByChange.set("abc", ["main", "release"]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders with empty changes and no graph", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, []);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders full split-panel layout for selected change", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "abc",
          description: "feat: add login page",
          author: "Alice",
          parentIds: [],
        }),
      ]);
      state.files = [
        { status: "A", path: "src/login.tsx", insertions: 50, deletions: 0 },
        { status: "M", path: "src/App.tsx", insertions: 5, deletions: 1 },
      ];
      state.selectionState.fileIndex = 0;
      state.diffContent = [
        "diff --git a/src/login.tsx b/src/login.tsx",
        "+++ b/src/login.tsx",
        "@@ -0,0 +1,50 @@",
        "+export function Login() {",
        "+  return <div>Login</div>;",
        "+}",
      ];
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders correctly at narrow width with clipping", async () => {
    const visibleLines = await renderSnapshot(60, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "long",
          description:
            "feat: add very long description that should be clipped at narrow width",
          author: "Alice Johnson",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders multiple changes with graph layout and descriptions", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      // Simulates the actual repo: linear chain with parentIds matching
      setMockChanges(state, [
        createMockChange({
          changeId: "sxopy",
          description: "",
          author: "Bob",
          parentIds: ["uunvs"],
        }),
        createMockChange({
          changeId: "uunvs",
          description: "(no description)",
          author: "Bob",
          parentIds: ["uupss"],
        }),
        createMockChange({
          changeId: "uupss",
          description: "chore(agent): bump lastChangelogVersion to 0.67.67",
          author: "Bob",
          parentIds: ["zxtkp"],
        }),
        createMockChange({
          changeId: "zxtkp",
          description:
            "docs(fallow): restructure prompt into sequential detect-fix-check loops",
          author: "Bob",
          parentIds: ["tkllr"],
        }),
        createMockChange({
          changeId: "tkllr",
          description:
            "chore(deps): bump dependency versions in turn-stats extension",
          author: "Bob",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders immutable commits with dim styling", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "imm",
          description: "immutable commit",
          author: "Alice",
          immutable: true,
          parentIds: [],
        }),
        createMockChange({
          changeId: "mut",
          description: "mutable commit",
          author: "Alice",
          immutable: false,
          parentIds: ["imm"],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });
});

describe("selected / marked changes", () => {
  it("then renders select marker for selected change", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "a",
          description: "first change",
          author: "Alice",
          parentIds: [],
        }),
        createMockChange({
          changeId: "b",
          description: "second change",
          author: "Bob",
          parentIds: ["a"],
        }),
      ]);
      state.selectedChangeIds.add("b");
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders marked background for selected change", async () => {
    const rawLines = await renderRawSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "x",
          description: "selected change",
          author: "Alice",
          parentIds: [],
        }),
      ]);
      state.selectedChangeIds.add("x");
    });
    expect(rawLines).toMatchSnapshot();
  });

  it("then extends marked background to full row width for empty description", async () => {
    const rawLines = await renderRawSnapshot(60, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "empty",
          description: "",
          author: "Alice",
          parentIds: [],
        }),
      ]);
      state.selectedChangeIds.add("empty");
    });
    expect(rawLines).toMatchSnapshot();
  });
});

describe("author formatting", () => {
  it("then renders author column when present", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "a",
          description: "commit a",
          author: "Alice Smith",
          parentIds: [],
        }),
        createMockChange({
          changeId: "b",
          description: "commit b",
          author: "Bob Jones",
          parentIds: ["a"],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then omits author column when no author", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "a",
          description: "commit a",
          author: "",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });
});

describe("edge cases", () => {
  it("then handles single character width gracefully", async () => {
    const visibleLines = await renderSnapshot(30, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "x",
          description: "short",
          author: "A",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then handles very long descriptions with truncation", async () => {
    const visibleLines = await renderSnapshot(80, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "long",
          description:
            "This is a very long commit message that should be truncated when the available width is narrow enough to cause overflow in the change row display area",
          author: "Alice Johnson",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders filter name in left title", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [defaultMockChange()]);
      state.currentFilterIndex = 1;
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then handles change with empty description", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "empty-desc",
          description: "",
          author: "Alice",
          parentIds: [],
        }),
      ]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders working copy as selected change", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "wc",
          description: "work in progress",
          author: "Alice",
          parentIds: ["prev"],
        }),
        createMockChange({
          changeId: "prev",
          description: "previous commit",
          author: "Bob",
          parentIds: [],
        }),
      ]);
      state.currentChangeId = "wc";
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders change at bottom of list", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "a",
          description: "first",
          author: "Alice",
          parentIds: [],
        }),
        createMockChange({
          changeId: "b",
          description: "second",
          author: "Alice",
          parentIds: ["a"],
        }),
        createMockChange({
          changeId: "c",
          description: "third",
          author: "Alice",
          parentIds: ["b"],
        }),
      ]);
      state.selectionState.selectedIndex = 2;
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders change with multiple bookmarks", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [featureBookmarkChange()]);
      state.bookmarksByChange.set("abc", ["main", "develop", "release"]);
    });
    expect(visibleLines).toMatchSnapshot();
  });

  it("then renders change with single bookmark", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [featureBookmarkChange()]);
      state.bookmarksByChange.set("abc", ["main"]);
    });
    expect(visibleLines).toMatchSnapshot();
  });
});
