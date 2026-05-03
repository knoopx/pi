import "../test-setup";

import { describe, it, expect, vi } from "vitest";
import type { KeybindingsManager } from "@mariozechner/pi-coding-agent";
import { createTodosComponent } from "./component";
import {
  createErrorFixture,
  createComponentTest,
  snapshotRender,
} from "../../lib/test-utils";
import type { AstGrepMatch } from "./types";

const REPO = "/tmp/test-project";

function makeAstGrepMatches(matches: Partial<AstGrepMatch>[]): string {
  return JSON.stringify(
    matches.map((m, i) => ({
      file: m.file ?? `src/file${i}.ts`,
      text: m.text ?? `// TODO: fix this`,
      range: m.range ?? {
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
      },
    })),
  );
}

async function createFixture(stdout: string) {
  return createComponentTest(
    createTodosComponent as unknown as (options: Record<string, unknown>) => {
      render: (cols: number) => string[];
    },
    {
      stdout,
      keybindings: {} as KeybindingsManager,
      done: vi.fn(),
      initialQuery: "",
      cwd: REPO,
    },
  );
}

async function renderMatches(matches: Partial<AstGrepMatch>[]) {
  const { component } = await createFixture(makeAstGrepMatches(matches));
  return component.render(120);
}

describe("todos — list row rendering", () => {
  describe("given empty results", () => {
    it("renders the no items message", async () => {
      const { component } = await createFixture("[]");
      snapshotRender(component);
    });
  });

  describe("given a single TODO item", () => {
    it("renders the TODO with file path and line number", async () => {
      const { component } = await createFixture(
        makeAstGrepMatches([
          {
            text: "// TODO: implement keyboard shortcut for file preview toggle",
            file: "agent/extensions/ide/components/files/component.ts",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given multiple TODO items", () => {
    it("renders all TODOs with consistent padding", async () => {
      const result = await renderMatches([
        {
          text: "// TODO: implement keyboard shortcut for file preview toggle",
          file: "agent/extensions/ide/components/files/component.ts",
        },
        {
          text: "// TODO: add error handling for jj command failures",
          file: "agent/extensions/ide/components/bookmarks/component.ts",
        },
        {
          text: "// FIXME: memory leak in split-panel when switching focus",
          file: "agent/extensions/ide/lib/split-panel/index.ts",
        },
        {
          text: "// HACK: workaround for terminal width calculation on resize",
          file: "agent/extensions/ide/lib/list-picker.ts",
        },
      ]);
      expect(result.join("\n")).toMatchSnapshot();
    });

    it("renders mixed TODO/FIXME/HACK/XXX tags", async () => {
      const result = await renderMatches([
        {
          text: "// TODO: implement file preview toggle",
          file: "agent/extensions/ide/components/files/component.ts",
        },
        {
          text: "// FIXME: race condition in list-picker update",
          file: "agent/extensions/ide/lib/list-picker.ts",
        },
        {
          text: "// HACK: workaround for terminal width on resize",
          file: "agent/extensions/ide/lib/split-panel/index.ts",
        },
        {
          text: "// XXX: needs review split panel border rendering",
          file: "agent/extensions/ide/lib/split-panel/renderer.ts",
        },
      ]);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a long TODO list", () => {
    it("renders scrollable rows with consistent padding", async () => {
      const tasks = [
        {
          text: "// TODO: implement keyboard shortcut for file preview toggle",
          file: "agent/extensions/ide/components/files/component.ts",
        },
        {
          text: "// FIXME: race condition in list-picker update cycle",
          file: "agent/extensions/ide/lib/list-picker.ts",
        },
        {
          text: "// TODO: add rate limiting for concurrent file reads",
          file: "agent/extensions/ide/lib/preview-utils.ts",
        },
        {
          text: "// HACK: workaround for terminal width on resize events",
          file: "agent/extensions/ide/lib/split-panel/index.ts",
        },
        {
          text: "// XXX: deprecate legacy render method in split panel",
          file: "agent/extensions/ide/lib/split-panel/renderer.ts",
        },
        {
          text: "// TODO: migrate test suite to vitest v2",
          file: "vitest.config.ts",
        },
        {
          text: "// FIXME: memory leak when switching between workspaces",
          file: "agent/extensions/ide/components/workspaces/view.ts",
        },
        {
          text: "// TODO: add unit tests for symbol-utils formatting",
          file: "agent/extensions/ide/lib/symbol-utils.ts",
        },
        {
          text: "// TODO: optimize file icon resolution performance",
          file: "agent/extensions/ide/lib/file-icons.ts",
        },
        {
          text: "// FIXME: flaky test in split-panel border rendering",
          file: "agent/extensions/ide/lib/split-panel/border.ts",
        },
        {
          text: "// HACK: polyfill for older Nerd Font versions",
          file: "agent/extensions/ide/lib/file-icons.ts",
        },
        {
          text: "// XXX: review error handling in jj command wrapper",
          file: "agent/shared/tool-result.ts",
        },
        {
          text: "// TODO: implement caching layer for file previews",
          file: "agent/extensions/ide/lib/preview-utils.ts",
        },
        {
          text: "// FIXME: focus state not syncing across split panes",
          file: "agent/extensions/ide/components/changes/state.ts",
        },
        {
          text: "// TODO: add request validation for symbol queries",
          file: "agent/extensions/ide/components/symbols/helpers.ts",
        },
        {
          text: "// TODO: improve logging format for tool execution",
          file: "agent/shared/tool-result.ts",
        },
        {
          text: "// FIXME: timeout when loading large diffs",
          file: "agent/extensions/ide/components/changes/service.ts",
        },
        {
          text: "// HACK: hotfix for bookmark list parsing edge case",
          file: "agent/extensions/ide/components/bookmarks/helpers.ts",
        },
        {
          text: "// XXX: technical debt in workspace state management",
          file: "agent/extensions/ide/components/workspaces/data-loading.ts",
        },
        {
          text: "// TODO: set up GitHub Actions for CI pipeline",
          file: ".github/workflows/ci.yml",
        },
      ];
      const matches = tasks.map((task, i) => ({
        text: task.text,
        file: task.file ?? `src/module${i}.ts`,
      }));
      const result = await renderMatches(matches);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a scan error", () => {
    it("renders empty list when ast-grep fails", async () => {
      const result = await createErrorFixture({
        componentFactory: createTodosComponent as unknown as (
          options: Record<string, unknown>,
        ) => {
          render: (cols: number) => string[];
        },
        config: {
          keybindings: {} as KeybindingsManager,
          done: vi.fn(),
          initialQuery: "",
          cwd: REPO,
        },
        stderr: "ast-grep: no such command",
      });
      expect(result.join("\n")).toMatchSnapshot();
    });
  });
});
