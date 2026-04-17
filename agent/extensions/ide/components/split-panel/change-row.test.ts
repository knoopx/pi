import { describe, it, expect } from "vitest";
import type { GraphLayout } from "../graph";
import { ChangeRow, EmptyChangeRow, type ChangeRowFlags } from "./change-row";
import { createMockTheme, stripAnsi } from "../test-utils";

const mockLayout = {
  positions: new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 2, y: 1 }],
    ["c", { x: 4, y: 2 }],
  ]),
  edges: [[], [], []],
  maxX: 4,
} as unknown as GraphLayout;

const defaultFlags: ChangeRowFlags = {
  isCursor: false,
  isMarked: false,
  isFocused: false,
  isWorkingCopy: false,
  isMoving: false,
};

function makeRow(
  desc = "feat: add login",
  author = "Alice",
  overrides: Partial<typeof defaultFlags> = {},
  layout: GraphLayout | null = null,
  bookmarks: string[] = [],
): ChangeRow {
  return new ChangeRow({
    change: {
      changeId: "a",
      immutable: desc.includes("immutable"),
      description: desc,
      author,
    },
    idx: 0,
    flags: { ...defaultFlags, ...overrides },
    bookmarks,
    theme: createMockTheme(),
    layout,
  });
}

// ─── Snapshot tests — normal rows ────────────────────────────────────────────

describe("ChangeRow snapshots", () => {
  it("normal change with graph and author", () => {
    const [line] = makeRow().render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("normal change without graph", () => {
    const [line] = makeRow("feat: add login", "Alice", {}, null).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("empty description, no author", () => {
    const [line] = makeRow("", "").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("immutable change", () => {
    const [line] = makeRow("immutable").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with graph prefix", () => {
    const [line] = makeRow("feat: add login", "Alice", {}, mockLayout).render(
      80,
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("working copy with accent", () => {
    const [line] = makeRow(
      "wip",
      "",
      { isWorkingCopy: true },
      mockLayout,
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("move mode indicator", () => {
    const [line] = makeRow("moving", "", { isMoving: true }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with bookmarks", () => {
    const [line] = makeRow("bookmark", "", {}, null, [
      "main",
      "release",
    ]).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long description at narrow width", () => {
    const [line] = makeRow(
      "this is a very long commit message that should be truncated",
    ).render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long author name", () => {
    const [line] = makeRow("x", "Xavier Longname III").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("no author column", () => {
    const [line] = makeRow("", "").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});

// ─── Snapshot tests — focused rows (cursor on change) ────────────────────────

describe("ChangeRow focused snapshots", () => {
  function focused(desc = "feat: x", author = "Alice"): ChangeRow {
    return makeRow(desc, author, { isCursor: true, isFocused: true });
  }

  it("short description", () => {
    const [line] = focused("").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("empty description no author", () => {
    const [line] = focused("", "").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long description", () => {
    const [line] = focused("this is a very long commit message").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with graph prefix", () => {
    const [line] = makeRow(
      "graph",
      "",
      { isCursor: true, isFocused: true },
      mockLayout,
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with move indicator", () => {
    const [line] = makeRow("moving", "", {
      isCursor: true,
      isFocused: true,
      isMoving: true,
    }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with working copy icon", () => {
    const [line] = makeRow(
      "wip",
      "",
      { isCursor: true, isFocused: true, isWorkingCopy: true },
      mockLayout,
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("immutable focused", () => {
    const [line] = focused("immutable").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("narrow width", () => {
    const [line] = focused("").render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("very narrow width", () => {
    const [line] = focused("").render(20);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long desc narrow width", () => {
    const [line] = focused(
      "this is a very long commit message that should be truncated",
    ).render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long author", () => {
    const [line] = focused("x", "Xavier Longname III").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with bookmarks", () => {
    const [line] = makeRow(
      "bm",
      "",
      { isCursor: true, isFocused: true },
      null,
      ["main", "develop"],
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("graph + move indicator", () => {
    const [line] = makeRow(
      "move",
      "",
      { isCursor: true, isFocused: true, isMoving: true },
      mockLayout,
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("working copy + focused", () => {
    const [line] = makeRow(
      "wip",
      "",
      { isCursor: true, isFocused: true, isWorkingCopy: true },
      mockLayout,
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("immutable + graph", () => {
    const [line] = makeRow(
      "imm",
      "",
      { isCursor: true, isFocused: true },
      mockLayout,
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("no author focused", () => {
    const [line] = focused("", "").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("bookmark + move indicator", () => {
    const [line] = makeRow(
      "bm-move",
      "",
      { isCursor: true, isFocused: true, isMoving: true },
      null,
      ["main"],
    ).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("normal change at narrow width", () => {
    const [line] = makeRow().render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("empty description at narrow width", () => {
    const [line] = makeRow("").render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long author at narrow width", () => {
    const [line] = makeRow("x", "Xavier Longname III").render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("graph + immutable", () => {
    const [line] = makeRow("imm", "", {}, mockLayout).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("working copy at narrow width", () => {
    const [line] = makeRow(
      "wip",
      "",
      { isWorkingCopy: true },
      mockLayout,
    ).render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("move mode at narrow width", () => {
    const [line] = makeRow("", "", { isMoving: true }).render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with multiple bookmarks", () => {
    const [line] = makeRow("multi-bm", "", {}, null, [
      "main",
      "develop",
      "release",
    ]).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with single bookmark", () => {
    const [line] = makeRow("bm", "", {}, null, ["main"]).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});

// ─── Snapshot tests — focused rows (marked) ──────────────────────────────────

describe("ChangeRow marked snapshots", () => {
  function marked(
    desc = "feat: x",
    author = "Alice",
    opts?: {
      layout?: GraphLayout | null;
      bookmarks?: string[];
      flags?: Partial<ChangeRowFlags>;
    },
  ): ChangeRow {
    const {
      layout = null,
      bookmarks = [],
      flags: extraFlags = {},
    } = opts ?? {};
    return new ChangeRow({
      change: {
        changeId: "a",
        immutable: desc.includes("immutable"),
        description: desc,
      },
      idx: 0,
      flags: {
        isCursor: false,
        isMarked: true,
        isFocused: false,
        isWorkingCopy: false,
        isMoving: false,
        ...extraFlags,
      } as any,
      bookmarks,
      theme: createMockTheme(),
      layout,
    });
  }

  it("short description", () => {
    const [line] = marked("").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("empty description no author", () => {
    const [line] = marked("", "").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long description", () => {
    const [line] = marked("this is a very long commit message").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with graph prefix", () => {
    const [line] = marked("graph", "", { layout: mockLayout }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with move indicator", () => {
    const [line] = marked("moving", "", { flags: { isMoving: true } }).render(
      80,
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with working copy icon", () => {
    const [line] = marked("wip", "", {
      layout: mockLayout,
      flags: { isWorkingCopy: true },
    }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("immutable marked", () => {
    const [line] = marked("immutable").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("narrow width", () => {
    const [line] = marked("").render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long author", () => {
    const [line] = marked("x", "Xavier Longname III").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with bookmarks", () => {
    const [line] = marked("bm", "", { bookmarks: ["main"] }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("graph + move indicator", () => {
    const [line] = marked("move", "", {
      layout: mockLayout,
      flags: { isMoving: true },
    }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("working copy + marked", () => {
    const [line] = marked("wip", "", {
      layout: mockLayout,
      flags: { isWorkingCopy: true },
    }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("immutable + graph", () => {
    const [line] = marked("imm", "", { layout: mockLayout }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("no author marked", () => {
    const [line] = marked("", "").render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("bookmark + move indicator", () => {
    const [line] = marked("bm-move", "", {
      bookmarks: ["main"],
      flags: { isMoving: true },
    }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("normal marked at narrow width", () => {
    const [line] = marked().render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("empty description marked at narrow width", () => {
    const [line] = marked("").render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("long author marked at narrow width", () => {
    const [line] = marked("x", "Xavier Longname III").render(40);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with multiple bookmarks", () => {
    const [line] = marked("multi-bm", "", {
      bookmarks: ["main", "develop", "release"],
    }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("with single bookmark", () => {
    const [line] = marked("bm", "", { bookmarks: ["main"] }).render(80);
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});

// ─── Snapshot tests — empty change row ───────────────────────────────────────

describe("EmptyChangeRow snapshots", () => {
  it("renders 'No changes' in dim color", () => {
    const [line] = new EmptyChangeRow("No changes", createMockTheme()).render(
      80,
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("truncates long message at narrow width", () => {
    const [line] = new EmptyChangeRow(
      "This is a very long empty message",
      createMockTheme(),
    ).render(30);
    expect(stripAnsi(line)).toMatchSnapshot();
  });

  it("renders at very narrow width", () => {
    const [line] = new EmptyChangeRow("No changes", createMockTheme()).render(
      15,
    );
    expect(stripAnsi(line)).toMatchSnapshot();
  });
});
