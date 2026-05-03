import { describe, it, expect, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi
    .fn()
    .mockResolvedValue(
      [
        'import type { Component } from "@mariozechner/pi-tui";',
        "export interface StubItem {",
        "  id: string;",
        "  label: string;",
        "}",
      ].join("\n"),
    ),
}));
import type {
  ExtensionContext,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import { createSymbolReferenceComponent } from "./component";
import {
  createErrorFixture,
  createMockPi,
  createComponentFixture,
} from "../../lib/test-utils";

const REPO = "/tmp/test-project";

// cm output format: Name|Type|File|Lines
function makeCmOutput(lines: string[]): string {
  return lines.join("\n");
}

async function createFixture(cmStdout: string, title: string) {
  const mockPi = createMockPi({
    exec: vi.fn().mockResolvedValue({ code: 0, stdout: cmStdout, stderr: "" }),
  });
  const { component, tui } = createComponentFixture(
    createSymbolReferenceComponent as unknown as (
      options: Record<string, unknown>,
    ) => {
      render: (cols: number) => string[];
    },
    {
      pi: mockPi,
      keybindings: Object.assign(Object.create(null), {}) as KeybindingsManager,
      done: vi.fn(),
      config: {
        title,
        command: "cm",
        args: ["query", "testSymbol"],
        ctx: { cwd: REPO } as ExtensionContext,
      },
    },
  );

  await new Promise((r) => setTimeout(r, 50));
  return { component, tui };
}

describe("symbol-references — list row rendering", () => {
  describe("given callers results", () => {
    it("renders caller symbols with file paths and line numbers", async () => {
      const output = makeCmOutput([
        "createFilesComponent|f|./agent/extensions/ide/components/files/component.ts|28-60",
        "createSymbolsComponent|f|./agent/extensions/ide/components/symbols/component.ts|35-70",
        "createListPicker|f|./agent/extensions/ide/lib/list-picker.ts|12-40",
      ]);
      const { component } = await createFixture(output, "Callers");
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given callees results", () => {
    it("renders callee symbols with consistent padding", async () => {
      const output = makeCmOutput([
        "querySymbols|f|./agent/extensions/ide/components/symbols/helpers.ts|10-25",
        "formatSymbolListEntry|f|./agent/extensions/ide/lib/symbol-utils.ts|5-20",
        "loadFilePreviewWithShiki|f|./agent/extensions/ide/lib/file-preview.ts|30-40",
      ]);
      const { component } = await createFixture(output, "Callees");
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given types results", () => {
    it("renders type references with definitions", async () => {
      const output = makeCmOutput([
        "ListPickerComponent|t|./agent/extensions/ide/lib/list-picker.ts|15-20",
        "SymbolResult|t|./agent/extensions/ide/components/symbols/types.ts|25-30",
        "FileResult|i|./agent/extensions/ide/components/files/types.ts|5-15",
      ]);
      const { component } = await createFixture(output, "Types");
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given schema results", () => {
    it("renders schema fields with consistent padding", async () => {
      const output = makeCmOutput([
        "pi|f|./agent/extensions/ide/components/files/component.ts|3|ExtensionAPI",
        "tui|f|./agent/extensions/ide/components/files/component.ts|4|TUI",
        "theme|f|./agent/extensions/ide/components/files/component.ts|5|Theme",
        "ctx|f|./agent/extensions/ide/components/files/component.ts|6|ExtensionContext",
      ]);
      const { component } = await createFixture(output, "Schema");
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given empty results", () => {
    it("renders the no items message", async () => {
      const { component } = await createFixture("", "Callers");
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a long results list", () => {
    it("renders scrollable rows with consistent padding", async () => {
      const symbols = [
        [
          "createFilesComponent",
          "./agent/extensions/ide/components/files/component.ts",
          "28-60",
        ],
        [
          "createSymbolsComponent",
          "./agent/extensions/ide/components/symbols/component.ts",
          "35-70",
        ],
        [
          "createBookmarksComponent",
          "./agent/extensions/ide/components/bookmarks/component.ts",
          "10-45",
        ],
        [
          "createTodosComponent",
          "./agent/extensions/ide/components/todos/component.ts",
          "50-65",
        ],
        [
          "createListPicker",
          "./agent/extensions/ide/lib/list-picker.ts",
          "12-25",
        ],
        [
          "formatSymbolListEntry",
          "./agent/extensions/ide/lib/symbol-utils.ts",
          "30-45",
        ],
        [
          "querySymbols",
          "./agent/extensions/ide/components/symbols/helpers.ts",
          "20-55",
        ],
        [
          "loadFilePreviewWithShiki",
          "./agent/extensions/ide/lib/file-preview.ts",
          "15-30",
        ],
        [
          "createFilePreviewLoader",
          "./agent/extensions/ide/lib/preview-utils.ts",
          "35-45",
        ],
        ["openEditor", "./agent/extensions/ide/lib/editor-utils.ts", "50-60"],
        ["getFileIcon", "./agent/extensions/ide/lib/file-icons.ts", "10-25"],
        [
          "highlightCodeLines",
          "./agent/extensions/ide/lib/file-preview.ts",
          "30-40",
        ],
        [
          "createSplitPanel",
          "./agent/extensions/ide/lib/split-panel/index.ts",
          "15-30",
        ],
        [
          "renderBorder",
          "./agent/extensions/ide/lib/split-panel/border.ts",
          "35-45",
        ],
        [
          "calculateGraphLayout",
          "./agent/extensions/ide/lib/graph.ts",
          "20-35",
        ],
        [
          "buildGraphInput",
          "./agent/extensions/ide/components/changes/types.ts",
          "40-55",
        ],
        ["createMockPi", "./agent/extensions/ide/lib/test-utils.ts", "60-75"],
        ["createMockTui", "./agent/extensions/ide/lib/test-utils.ts", "10-25"],
        [
          "createMockTheme",
          "./agent/extensions/ide/lib/test-utils.ts",
          "30-45",
        ],
        [
          "matchesKey",
          "./node_modules/@mariozechner/pi-tui/dist/index.ts",
          "15-30",
        ],
      ];
      const output = symbols.map(
        ([name, file, lines]) => `${name}|f|${file}|${lines}`,
      );
      const { component } = await createFixture(
        makeCmOutput(output),
        "References",
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a cm command error", () => {
    it("renders empty list when cm fails", async () => {
      const result = await createErrorFixture({
        componentFactory: createSymbolReferenceComponent as unknown as (
          options: Record<string, unknown>,
        ) => {
          render: (cols: number) => string[];
        },
        config: {
          keybindings: Object.assign(
            Object.create(null),
            {},
          ) as KeybindingsManager,
          done: vi.fn(),
          config: {
            title: "Callers",
            command: "cm",
            args: ["callers", "missingSymbol"],
            ctx: { cwd: REPO } as ExtensionContext,
          },
        },
        stderr: "Symbol not found",
      });
      expect(result.join("\n")).toMatchSnapshot();
    });
  });
});
