import { describe, it, expect } from "vitest";
import { createMockChange } from "../../lib/test-utils";
import {
  renderSnapshot,
  defaultMockChange,
  setMockChanges,
  loadingStateConfig,
} from "./test-helpers";

describe("loading state", () => {
  it("then renders loading indicator", async () => {
    const visibleLines = await renderSnapshot(120, loadingStateConfig);
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });
});

describe("focus switching", () => {
  it("then renders right focus indicator when focused on files", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [defaultMockChange()]);
      state.files = [
        {
          status: "M",
          path: "agent/extensions/ide/components/files/component.ts",
          insertions: 42,
          deletions: 18,
        },
      ];
      state.selectionState.fileIndex = 0;
      state.diffContent = [
        "diff --git a/agent/extensions/ide/components/files/component.ts b/agent/extensions/ide/components/files/component.ts",
        "index e3b0c44..a1b2c3d 100644",
        "--- a/agent/extensions/ide/components/files/component.ts",
        "+++ b/agent/extensions/ide/components/files/component.ts",
        "@@ -1,5 +1,7 @@",
        " import { Component } from '@earendil-works/pi-tui';",
        "+import type { FileInfo } from '../../lib/types';",
        "+",
        "  export class FilesComponent extends Component {",
        "-    private items: string[] = [];",
        "+    private items: FileInfo[] = [];",
        "+    private selectedPaths: Set<string> = new Set();",
      ];
      state.selectionState.focus = "right";
    });
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });

  it("then renders left focus indicator when focused on changes", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [defaultMockChange()]);
      state.files = [
        { status: "A", path: "src/login.tsx", insertions: 50, deletions: 0 },
        { status: "M", path: "src/App.tsx", insertions: 12, deletions: 4 },
        { status: "D", path: "src/old-page.tsx", insertions: 0, deletions: 35 },
      ];
      state.selectionState.fileIndex = 0;
      state.diffContent = [
        "diff --git a/src/login.tsx b/src/login.tsx",
        "new file mode 100644",
        "index 0000000..a3f2c1d",
        "--- /dev/null",
        "+++ b/src/login.tsx",
        "@@ -0,0 +1,8 @@",
        "+import { useState } from 'react';",
        "+",
        "+export function LoginForm() {",
        "+  const [email, setEmail] = useState('');",
        "+  const handleSubmit = (e: React.FormEvent) => {",
        "+    e.preventDefault();",
        "+  };",
        "+  return <form onSubmit={handleSubmit}>Sign in</form>;",
        "+}",
      ];
      state.selectionState.focus = "left";
    });
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });
});

describe("move mode", () => {
  it("then renders move indicator on cursor change", async () => {
    const visibleLines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "a",
          description: "feat(ide): add split panel preview for file explorer",
          author: "knoopx",
          parentIds: [],
        }),
        createMockChange({
          changeId: "b",
          description: "fix(tui): resolve race condition in list-picker update",
          author: "knoopx",
          parentIds: ["a"],
        }),
      ]);
      state.mode = "move";
      state.moveOriginalIndex = 1;
    });
    expect(visibleLines.join("\n")).toMatchSnapshot();
  });
});

describe("ANSI styling", () => {
  it("then includes selected background on marked changes", async () => {
    const lines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "x",
          description: "feat(ide): add split panel preview for file explorer",
          author: "knoopx",
          parentIds: [],
        }),
      ]);
      state.selectedChangeIds.add("x");
    });
    const firstRow = lines[3];
    expect(firstRow).toContain("\x1b[48;2;50;36;93m");
  });

  it("then includes dim styling on immutable changes", async () => {
    const lines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "imm",
          description:
            "chore: initial commit - scaffold pi coding agent project",
          author: "knoopx",
          immutable: true,
          parentIds: [],
        }),
      ]);
    });
    const firstRow = lines[3];
    expect(firstRow).toContain("\x1b[38;2;76;62;118m");
  });

  it("then includes accent styling on working copy", async () => {
    const lines = await renderSnapshot(120, (state) => {
      setMockChanges(state, [
        createMockChange({
          changeId: "wc",
          description: "feat(ide): WIP integrate pi-tui component architecture",
          author: "knoopx",
          parentIds: [],
        }),
      ]);
      state.currentChangeId = "wc";
    });
    const firstRow = lines[3];
    expect(firstRow).toContain("\x1b[38;2;250;208;0m");
  });
});
