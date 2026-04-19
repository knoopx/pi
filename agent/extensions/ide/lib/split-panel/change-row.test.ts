import { describe, it, expect } from "vitest";
import type { GraphLayout } from "../graph";
import { ChangeRow, type ChangeRowFlags } from "./change-row";
import { createEmptyChangeRow } from "./empty-rows";
import { createMockTheme } from "../../lib/test-utils";

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

interface MakeRowOpts {
  desc?: string;
  author?: string;
  flags?: Partial<typeof defaultFlags>;
  layout?: GraphLayout | null;
  bookmarks?: string[];
}

function makeRow(opts: MakeRowOpts = {}): ChangeRow {
  const {
    desc = "feat: add login",
    author = "Alice",
    flags: overrides = {},
    layout = null,
    bookmarks = [],
  } = opts;
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
    expect(line).toMatchSnapshot();
  });

  it("normal change without graph", () => {
    const [line] = makeRow({ desc: "feat: add login", author: "Alice" }).render(
      80,
    );
    expect(line).toMatchSnapshot();
  });

  it("empty description, no author", () => {
    const [line] = makeRow({ desc: "", author: "" }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("immutable change", () => {
    const [line] = makeRow({ desc: "immutable" }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("with graph prefix", () => {
    const [line] = makeRow({
      desc: "feat: add login",
      author: "Alice",
      layout: mockLayout,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("working copy with accent", () => {
    const [line] = makeRow({
      desc: "wip",
      author: "",
      flags: { isWorkingCopy: true },
      layout: mockLayout,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("move mode indicator", () => {
    const [line] = makeRow({
      desc: "moving",
      author: "",
      flags: { isMoving: true },
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("with bookmarks", () => {
    const [line] = makeRow({
      desc: "bookmark",
      author: "",
      bookmarks: ["main", "release"],
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("long description at narrow width", () => {
    const [line] = makeRow({
      desc: "this is a very long commit message that should be truncated",
    }).render(40);
    expect(line).toMatchSnapshot();
  });

  it("long author name", () => {
    const [line] = makeRow({
      desc: "x",
      author: "Xavier Longname III",
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("no author column", () => {
    const [line] = makeRow({ desc: "", author: "" }).render(80);
    expect(line).toMatchSnapshot();
  });
});

// ─── Shared row snapshot test runner ────────────────────────────────────────

interface RowSnapshotsConfig {
  makeRowFn: (desc: string, author: string, extra?: MakeRowOpts) => ChangeRow;
  baseFlags: Partial<typeof defaultFlags>;
  baseOpts?: MakeRowOpts;
}

function runRowSnapshots(config: RowSnapshotsConfig): void {
  const { makeRowFn: rowFn, baseFlags, baseOpts = {} } = config;

  it("short description", () => {
    const [line] = rowFn("", "").render(80);
    expect(line).toMatchSnapshot();
  });

  it("long description", () => {
    const [line] = rowFn("this is a very long commit message", "").render(80);
    expect(line).toMatchSnapshot();
  });

  it("with graph prefix", () => {
    const [line] = makeRow({
      desc: "graph",
      author: "",
      flags: baseFlags,
      layout: mockLayout,
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("with move indicator", () => {
    const [line] = makeRow({
      desc: "moving",
      author: "",
      flags: { ...baseFlags, isMoving: true },
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("with working copy icon", () => {
    const [line] = makeRow({
      desc: "wip",
      author: "",
      flags: { ...baseFlags, isWorkingCopy: true },
      layout: mockLayout,
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("immutable", () => {
    const [line] = rowFn("immutable", "").render(80);
    expect(line).toMatchSnapshot();
  });

  it("narrow width", () => {
    const [line] = rowFn("", "").render(40);
    expect(line).toMatchSnapshot();
  });

  it("long author", () => {
    const [line] = rowFn("x", "Xavier Longname III").render(80);
    expect(line).toMatchSnapshot();
  });

  it("with bookmarks", () => {
    const [line] = makeRow({
      desc: "bm",
      author: "",
      flags: baseFlags,
      bookmarks: ["main"],
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("graph + move indicator", () => {
    const [line] = makeRow({
      desc: "move",
      author: "",
      flags: { ...baseFlags, isMoving: true },
      layout: mockLayout,
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("working copy + state", () => {
    const [line] = makeRow({
      desc: "wip",
      author: "State Author",
      flags: { ...baseFlags, isWorkingCopy: true },
      layout: mockLayout,
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("immutable + graph", () => {
    const [line] = makeRow({
      desc: "imm",
      author: "",
      flags: baseFlags,
      layout: mockLayout,
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("no author", () => {
    const [line] = rowFn("", "").render(80);
    expect(line).toMatchSnapshot();
  });

  it("bookmark + move indicator", () => {
    const [line] = makeRow({
      desc: "bm-move",
      author: "",
      flags: { ...baseFlags, isMoving: true },
      bookmarks: ["main"],
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("normal at narrow width", () => {
    const [line] = makeRow({ flags: baseFlags, ...baseOpts }).render(40);
    expect(line).toMatchSnapshot();
  });

  it("empty description at narrow width", () => {
    const [line] = makeRow({ desc: "", flags: baseFlags, ...baseOpts }).render(
      40,
    );
    expect(line).toMatchSnapshot();
  });

  it("long author at narrow width", () => {
    const [line] = makeRow({
      desc: "x",
      author: "Xavier Longname III",
      flags: baseFlags,
      ...baseOpts,
    }).render(40);
    expect(line).toMatchSnapshot();
  });

  it("with multiple bookmarks", () => {
    const [line] = makeRow({
      desc: "multi-bm",
      author: "",
      flags: baseFlags,
      bookmarks: ["main", "develop", "release"],
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });

  it("with single bookmark", () => {
    const [line] = makeRow({
      desc: "bm",
      author: "",
      flags: baseFlags,
      bookmarks: ["main"],
      ...baseOpts,
    }).render(80);
    expect(line).toMatchSnapshot();
  });
}

// ─── Snapshot tests — focused rows (cursor on change) ────────────────────────

const FOCUSED_FLAGS: Partial<typeof defaultFlags> = {
  isCursor: true,
  isFocused: true,
};

describe("ChangeRow focused snapshots", () => {
  function focused(desc = "feat: x", author = "Alice"): ChangeRow {
    return makeRow({ desc, author, flags: FOCUSED_FLAGS });
  }

  runRowSnapshots({
    makeRowFn: focused,
    baseFlags: FOCUSED_FLAGS,
  });

  it("very narrow width", () => {
    const [line] = focused("").render(20);
    expect(line).toMatchSnapshot();
  });

  it("long desc narrow width", () => {
    const [line] = focused(
      "this is a very long commit message that should be truncated",
    ).render(40);
    expect(line).toMatchSnapshot();
  });
});

// ─── Snapshot tests — marked rows ──────────────────────────────────────────

const MARKED_FLAGS: Partial<typeof defaultFlags> = {
  isMarked: true,
};

describe("ChangeRow marked snapshots", () => {
  runRowSnapshots({
    makeRowFn: (desc, _author) =>
      makeRow({ desc, author: "", flags: MARKED_FLAGS }),
    baseFlags: MARKED_FLAGS,
  });
});

// ─── Snapshot tests — empty change row ───────────────────────────────────────

describe("createEmptyChangeRow snapshots", () => {
  it("renders 'No changes' in dim color", () => {
    const [line] = createEmptyChangeRow("No changes", createMockTheme()).render(
      80,
    );
    expect(line).toMatchSnapshot();
  });

  it("truncates long message at narrow width", () => {
    const [line] = createEmptyChangeRow(
      "This is a very long empty message",
      createMockTheme(),
    ).render(30);
    expect(line).toMatchSnapshot();
  });

  it("renders at very narrow width", () => {
    const [line] = createEmptyChangeRow("No changes", createMockTheme()).render(
      15,
    );
    expect(line).toMatchSnapshot();
  });
});
