import { describe, it, expect } from "vitest";
import type { GraphLayout } from "../graph";
import { createMockTheme, stripAnsi } from "../test-utils";
import { ChangeRowRenderer } from "./change-row";

const mockLayout = {
  positions: new Map([["a", { x: 0, y: 0 }]]),
  edges: [[]],
  maxX: 0,
} as unknown as GraphLayout;

const baseChange = {
  changeId: "a",
  immutable: false,
  description: "feat: add login",
  author: "Alice",
};

function makeRenderer(layout: GraphLayout | null = null) {
  return new ChangeRowRenderer(createMockTheme(), layout);
}

// ─── Normal rows ─────────────────────────────────────────────────────────────

describe("ChangeRowRenderer — normal", () => {
  it("then renders change without graph", () => {
    const line = makeRenderer().render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: false,
      isFocused: false,
      isWorkingCopy: false,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders empty description", () => {
    const line = makeRenderer().render(
      { ...baseChange, description: "" },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders immutable change", () => {
    const line = makeRenderer().render(
      { ...baseChange, immutable: true },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders working copy", () => {
    const line = makeRenderer().render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: false,
      isFocused: false,
      isWorkingCopy: true,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders with graph prefix", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: false,
      isFocused: false,
      isWorkingCopy: false,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders long description at narrow width", () => {
    const line = makeRenderer().render(
      {
        ...baseChange,
        description:
          "this is a very long commit message that should be truncated",
      },
      0,
      40,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders no author column", () => {
    const line = makeRenderer().render(
      { ...baseChange, author: undefined },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders long author name", () => {
    const line = makeRenderer().render(
      { ...baseChange, author: "Xavier Longname III" },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders immutable with graph", () => {
    const line = makeRenderer(mockLayout).render(
      { ...baseChange, immutable: true },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders working copy with graph", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: false,
      isFocused: false,
      isWorkingCopy: true,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});

// ─── Focused rows — bg extends to full width ─────────────────────────────────

describe("ChangeRowRenderer — focused", () => {
  function focused(row = baseChange) {
    return makeRenderer().render(row, 0, 80, {
      isCursor: true,
      isMarked: false,
      isFocused: true,
      isWorkingCopy: false,
    });
  }

  it("then wraps full row in selectedBg", () => {
    const line = focused();
    expect(line).toContain("[BG:selectedBg:");
  });

  function bgExtends(row = baseChange) {
    const line = focused(row);
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  }

  it("then extends bg to full width for short description", () =>
    bgExtends({ ...baseChange, description: "" }));
  it("then extends bg to full width for empty description", () =>
    bgExtends({ ...baseChange, description: "" }));

  it("then extends bg to full width for long description", () => {
    const line = focused({
      ...baseChange,
      description:
        "this is a very long commit message that takes up most of the available width",
    });
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  });

  it("then extends bg to full width with graph prefix", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: true,
      isMarked: false,
      isFocused: true,
      isWorkingCopy: false,
    });
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  });

  it("then extends bg to full width with author column", () => {
    const line = focused();
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  });

  it("then extends bg to full width with working copy", () => {
    const line = makeRenderer().render(baseChange, 0, 80, {
      isCursor: true,
      isMarked: false,
      isFocused: true,
      isWorkingCopy: true,
    });
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  });

  it("then extends bg to full width at narrow width", () => {
    const line = makeRenderer().render(
      { ...baseChange, description: "" },
      0,
      40,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(40);
  });

  it("then renders focused snapshot", () => {
    const line = focused();
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused empty snapshot", () => {
    const line = focused({ ...baseChange, description: "" });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused no author snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, author: undefined },
      0,
      80,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused with graph snapshot", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: true,
      isMarked: false,
      isFocused: true,
      isWorkingCopy: false,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused working copy snapshot", () => {
    const line = makeRenderer().render(baseChange, 0, 80, {
      isCursor: true,
      isMarked: false,
      isFocused: true,
      isWorkingCopy: true,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused immutable snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, immutable: true },
      0,
      80,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused narrow width snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, description: "" },
      0,
      40,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused with graph narrow snapshot", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 40, {
      isCursor: true,
      isMarked: false,
      isFocused: true,
      isWorkingCopy: false,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused immutable with graph snapshot", () => {
    const line = makeRenderer(mockLayout).render(
      { ...baseChange, immutable: true },
      0,
      80,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused working copy with graph snapshot", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: true,
      isMarked: false,
      isFocused: true,
      isWorkingCopy: true,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused long author snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, author: "Xavier Longname III" },
      0,
      80,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused long desc narrow snapshot", () => {
    const line = makeRenderer().render(
      {
        ...baseChange,
        description:
          "this is a very long commit message that should be truncated",
      },
      0,
      40,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused empty with graph narrow snapshot", () => {
    const line = makeRenderer(mockLayout).render(
      { ...baseChange, description: "" },
      0,
      40,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});

// ─── Marked rows — bg extends to full width ──────────────────────────────────

describe("ChangeRowRenderer — marked", () => {
  function marked(row = baseChange) {
    return makeRenderer().render(row, 0, 80, {
      isCursor: false,
      isMarked: true,
      isFocused: false,
      isWorkingCopy: false,
    });
  }

  function bgExtends(row = baseChange) {
    const line = marked(row);
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  }

  it("then wraps full row in selectedBg", () => {
    const line = marked();
    expect(line).toContain("[BG:selectedBg:");
  });

  it("then extends bg to full width for short description", () =>
    bgExtends({ ...baseChange, description: "" }));
  it("then extends bg to full width for empty description", () =>
    bgExtends({ ...baseChange, description: "" }));

  it("then extends bg to full width for long description", () => {
    const line = marked({
      ...baseChange,
      description:
        "this is a very long commit message that takes up most of the available width",
    });
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  });

  it("then extends bg to full width with graph prefix", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: true,
      isFocused: false,
      isWorkingCopy: false,
    });
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(80);
  });

  it("then extends bg to full width at narrow width", () => {
    const line = makeRenderer().render(
      { ...baseChange, description: "" },
      0,
      40,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(line).toContain("[BG:selectedBg:");
    expect(stripAnsi(line).length).toBeGreaterThanOrEqual(40);
  });

  it("then renders marked snapshot", () => {
    const line = marked();
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked empty snapshot", () => {
    const line = marked({ ...baseChange, description: "" });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked no author snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, author: undefined },
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked with graph snapshot", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: true,
      isFocused: false,
      isWorkingCopy: false,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked working copy snapshot", () => {
    const line = makeRenderer().render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: true,
      isFocused: false,
      isWorkingCopy: true,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked immutable snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, immutable: true },
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked narrow width snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, description: "" },
      0,
      40,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked with graph narrow snapshot", () => {
    const line = makeRenderer(mockLayout).render(
      { ...baseChange, description: "" },
      0,
      40,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked immutable with graph snapshot", () => {
    const line = makeRenderer(mockLayout).render(
      { ...baseChange, immutable: true },
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked working copy with graph snapshot", () => {
    const line = makeRenderer(mockLayout).render(baseChange, 0, 80, {
      isCursor: false,
      isMarked: true,
      isFocused: false,
      isWorkingCopy: true,
    });
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked long author snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, author: "Xavier Longname III" },
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked long desc narrow snapshot", () => {
    const line = makeRenderer().render(
      {
        ...baseChange,
        description:
          "this is a very long commit message that should be truncated",
      },
      0,
      40,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked empty no author snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, description: "", author: undefined },
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked no author narrow snapshot", () => {
    const line = makeRenderer().render(
      { ...baseChange, description: "", author: undefined },
      0,
      40,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});

// ─── With bookmarks ──────────────────────────────────────────────────────────

describe("ChangeRowRenderer — with bookmarks", () => {
  it("then renders change with single bookmark", () => {
    const line = makeRenderer().renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders change with multiple bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main", "develop", "release"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused change with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked change with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders empty description with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      { ...baseChange, description: "" },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders immutable with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      { ...baseChange, immutable: true },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main", "release"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders with graph and bookmarks", () => {
    const line = makeRenderer(mockLayout).renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused with graph and bookmarks", () => {
    const line = makeRenderer(mockLayout).renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: false,
      },
      ["main", "develop"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked with graph and bookmarks", () => {
    const line = makeRenderer(mockLayout).renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders focused working copy with graph and bookmarks", () => {
    const line = makeRenderer(mockLayout).renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: true,
        isMarked: false,
        isFocused: true,
        isWorkingCopy: true,
      },
      ["main", "develop"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders marked working copy with graph and bookmarks", () => {
    const line = makeRenderer(mockLayout).renderWithBookmarks(
      baseChange,
      0,
      80,
      {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: true,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders long description with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      {
        ...baseChange,
        description:
          "this is a very long commit message that should be truncated at narrow width",
      },
      0,
      40,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders long author with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      {
        ...baseChange,
        description: "x",
        author: "Xavier Longname III",
      },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders no author with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      { ...baseChange, author: undefined },
      0,
      80,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders narrow width with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      baseChange,
      0,
      40,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("then renders very narrow width with bookmarks", () => {
    const line = makeRenderer().renderWithBookmarks(
      baseChange,
      0,
      20,
      {
        isCursor: false,
        isMarked: false,
        isFocused: false,
        isWorkingCopy: false,
      },
      ["main"],
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});
