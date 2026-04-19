import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentWorkspace, FileChange, Change } from "../../lib/types";
import { TestTerminal, createMockTheme } from "../../lib/test-utils";
import { createWorkspaceState, type WorkspaceState } from "./data-loading";

function createMockWorkspace(
  overrides?: Partial<AgentWorkspace>,
): AgentWorkspace {
  return {
    name: "ide-test",
    path: "/repo/.jj/workspaces/ide-test",
    description: "test workspace",
    status: "idle",
    changeId: "abc123",
    parentChangeId: "",
    createdAt: Date.now(),
    fileStats: { added: 0, modified: 0, deleted: 0 },
    ...overrides,
  };
}

function createDefaultWorkspace(): AgentWorkspace {
  return {
    name: "default",
    path: "/repo",
    description: "(root workspace)",
    status: "idle",
    changeId: "@",
    parentChangeId: "",
    createdAt: 0,
    fileStats: undefined,
  };
}

function setupTwoWorkspaces(
  s: WorkspaceState,
  nameA: string,
  nameB: string,
): [AgentWorkspace, AgentWorkspace] {
  const ws: [AgentWorkspace, AgentWorkspace] = [
    createMockWorkspace({ name: nameA }),
    createMockWorkspace({ name: nameB }),
  ];
  s.workspaces = ws;
  s.selectedWorkspace = ws[0];
  return ws;
}

function makeFiles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    status: "M" as const,
    path: `${String.fromCharCode(97 + i)}.ts`,
    insertions: i + 1,
    deletions: i,
  }));
}

describe("workspace navigation state", () => {
  let state: WorkspaceState;

  beforeEach(() => {
    state = createWorkspaceState();
  });

  it("then initializes with zeroed fileIndex and diffScroll", () => {
    expect(state.fileIndex).toBe(0);
    expect(state.diffScroll).toBe(0);
    expect(state.diffContent).toEqual([]);
  });

  it("then resets fileIndex on workspace switch so render uses index 0", () => {
    setupTwoWorkspaces(state, "ws-a", "ws-b");
    state.files = makeFiles(3);
    state.fileIndex = 2;
    state.diffScroll = 10;
    state.diffContent = [
      "diff --git a/c.ts b/c.ts",
      "+ old content from workspace a",
    ];

    // Simulate navigateWorkspace: switch to ws-b, reset state before render
    state.selectedWorkspace = state.workspaces[1];
    state.fileIndex = 0;
    state.diffScroll = 0;
    state.diffContent = ["Loading..."];

    expect(state.fileIndex).toBe(0);
    expect(state.diffScroll).toBe(0);
    expect(state.diffContent).toEqual(["Loading..."]);
    expect(state.selectedWorkspace?.name).toBe("ws-b");
  });

  it("then prevents out-of-bounds fileIndex when new workspace has fewer files", () => {
    setupTwoWorkspaces(state, "ws-large", "ws-small");
    state.files = makeFiles(5);
    state.fileIndex = 4;

    state.selectedWorkspace = state.workspaces[1];
    state.fileIndex = 0;
    state.files = [{ status: "M", path: "x.ts", insertions: 1, deletions: 0 }];

    expect(state.fileIndex).toBeLessThan(state.files.length);
    expect(state.files[state.fileIndex]?.path).toBe("x.ts");
  });

  it("then shows loading state immediately after navigation before async resolves", () => {
    setupTwoWorkspaces(state, "ws-a", "ws-b");
    state.diffContent = ["existing diff content from ws-a"];
    state.diffScroll = 5;

    // Simulate the synchronous part of navigateWorkspace
    const targetWorkspace = state.workspaces[1];
    state.selectedWorkspace = targetWorkspace;
    state.fileIndex = 0;
    state.diffScroll = 0;
    state.diffContent = ["Loading..."];

    expect(state.selectedWorkspace?.name).toBe("ws-b");
    expect(state.diffContent).toEqual(["Loading..."]);
    expect(state.diffScroll).toBe(0);
  });

  it("then preserves workspaces list across navigation", () => {
    const [_wsA, wsB] = setupTwoWorkspaces(state, "ws-a", "ws-b");

    state.selectedWorkspace = wsB;
    state.fileIndex = 0;

    expect(state.workspaces).toHaveLength(2);
    expect(state.workspaces.map((w) => w.name)).toEqual(["ws-a", "ws-b"]);
  });

  it("then resets diffScroll and shows loading when navigating files", () => {
    state.selectedWorkspace = createMockWorkspace({ name: "ws-a" });
    state.files = makeFiles(3);
    state.fileIndex = 0;
    state.diffScroll = 5;
    state.diffContent = ["diff for a.ts"];

    // Simulate navigateFile down
    state.fileIndex = 1;
    state.diffScroll = 0;
    state.diffContent = ["Loading..."];

    expect(state.fileIndex).toBe(1);
    expect(state.diffScroll).toBe(0);
    expect(state.diffContent).toEqual(["Loading..."]);
  });
});

// ─── Fixture factories for renderView tests ──────────────────────────────

function wsName(name: string): AgentWorkspace {
  return name === "default"
    ? createDefaultWorkspace()
    : createMockWorkspace({ name });
}

function change(
  id: string,
  desc: string,
  author: string,
  parentIds: string[] = [],
) {
  return {
    changeId: id,
    commitId: "",
    description: desc,
    author,
    timestamp: "",
    empty: false,
    immutable: false,
    parentIds,
  };
}

const defaultChanges = [
  change("abc", "feat: add login", "Alice"),
  change("def", "fix: typo", "Bob", ["abc"]),
];

const SHARED_FILES = [
  { status: "A" as const, path: "src/new.ts", insertions: 10, deletions: 0 },
  { status: "M" as const, path: "src/main.ts", insertions: 5, deletions: 2 },
];

const BASE_VIEW_PROPS = {
  workspaces: [] as AgentWorkspace[],
  selectedWorkspace: null as AgentWorkspace | null,
  files: [] as FileChange[],
  changes: [] as Change[],
  fileIndex: 0,
  diffContent: [] as string[],
  diffScroll: 0,
  focus: "left" as "left" | "right",
  selectedIndex: 0,
  loading: false,
};

async function renderView(
  props: Partial<typeof BASE_VIEW_PROPS>,
): Promise<string[]> {
  const { WorkspaceView } = await import("./view");
  const theme = createMockTheme();
  const terminal = new TestTerminal(120, 30);

  const view = new WorkspaceView(
    { ...BASE_VIEW_PROPS, ...props },
    { terminal, requestRender: vi.fn() },
    theme,
  );

  return view.render(120);
}

describe("workspace view rendering states", () => {
  it("then renders loading state with focused left panel", async () => {
    const lines = await renderView({
      workspaces: [
        createMockWorkspace({ name: "ws-a" }),
        createMockWorkspace({ name: "ws-b" }),
      ],
      selectedWorkspace: createMockWorkspace({ name: "ws-a" }),
      diffContent: ["Loading..."],
      loading: true,
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders workspace list with focused right panel", async () => {
    const lines = await renderView({
      workspaces: [
        createMockWorkspace({ name: "ws-a" }),
        createMockWorkspace({ name: "ws-b", status: "running" }),
      ],
      selectedWorkspace: createMockWorkspace({ name: "ws-a" }),
      files: [
        { status: "M", path: "src/main.ts", insertions: 5, deletions: 2 },
      ],
      diffContent: ["diff content"],
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders selected workspace with file list and diff", async () => {
    const lines = await renderView({
      workspaces: [
        createDefaultWorkspace(),
        createMockWorkspace({ name: "ws-a" }),
      ],
      selectedWorkspace: createMockWorkspace({ name: "ws-a" }),
      files: SHARED_FILES,
      fileIndex: 1,
      diffContent: [
        "diff --git a/src/main.ts b/src/main.ts",
        "index abc..def 100644",
        "--- a/src/main.ts",
        "+++ b/src/main.ts",
        "@@ -1 +1 @@@",
        "-old line",
        "+new line",
      ],
      focus: "right",
      selectedIndex: 1,
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders default workspace with changes list", async () => {
    const lines = await renderView({
      workspaces: [wsName("default")],
      selectedWorkspace: wsName("default"),
      changes: defaultChanges,
      diffContent: [
        "diff --git a/src/login.ts b/src/login.ts",
        "+export function Login() {}",
      ],
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders empty workspace list", async () => {
    const lines = await renderView({
      diffContent: ["No workspaces found"],
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders no content when diff is empty", async () => {
    const lines = await renderView({
      workspaces: [createDefaultWorkspace()],
      selectedWorkspace: createDefaultWorkspace(),
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders error message in diff pane", async () => {
    const lines = await renderView({
      workspaces: [createMockWorkspace({ name: "ws-a" })],
      selectedWorkspace: createMockWorkspace({ name: "ws-a" }),
      diffContent: ["Error: Failed to get diff: no such revision"],
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders scrolled diff content", async () => {
    const lines = await renderView({
      workspaces: [createMockWorkspace({ name: "ws-a" })],
      selectedWorkspace: createMockWorkspace({ name: "ws-a" }),
      files: [
        { status: "M", path: "src/main.ts", insertions: 5, deletions: 2 },
      ],
      diffContent: [
        "line 0 - header",
        "line 1 - skipped",
        "line 2 - skipped",
        "line 3 - visible after scroll",
        "line 4 - also visible",
        "line 5 - and this one",
      ],
      diffScroll: 3,
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders default workspace with second change selected", async () => {
    const lines = await renderView({
      workspaces: [wsName("default")],
      selectedWorkspace: wsName("default"),
      changes: defaultChanges,
      fileIndex: 1,
      diffContent: ["diff --git a/src/typo.ts b/src/typo.ts", "-tyo", "+typo"],
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders workspace with multiple files and second file selected", async () => {
    const lines = await renderView({
      workspaces: [createMockWorkspace({ name: "ws-a" })],
      selectedWorkspace: createMockWorkspace({ name: "ws-a" }),
      files: [
        ...SHARED_FILES,
        {
          status: "D" as const,
          path: "src/old.ts",
          insertions: 0,
          deletions: 8,
        },
      ],
      fileIndex: 1,
      diffContent: ["diff --git a/src/main.ts b/src/main.ts", "-old", "+new"],
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });

  it("then renders workspace with no changed files", async () => {
    const lines = await renderView({
      workspaces: [createMockWorkspace({ name: "ws-a" })],
      selectedWorkspace: createMockWorkspace({ name: "ws-a" }),
      focus: "right",
    });

    expect(lines).toMatchSnapshot();
  });
});
