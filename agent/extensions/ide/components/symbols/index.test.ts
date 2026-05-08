import "../test-setup";

import { describe, it, expect, vi } from "vitest";
import type { ExecResult } from "@earendil-works/pi-coding-agent";
import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import { createSymbolsComponent } from "./component";
import {
  createMockTheme,
  createMockPi,
  createMockTui,
} from "../../lib/test-utils";
const theme = createMockTheme();
const SYMBY_TYPE: Record<string, string> = {
  class:
    "ListPickerComponent|c|./agent/extensions/ide/lib/list-picker.ts|45-120\nSplitPanel|c|./agent/extensions/ide/lib/split-panel/index.ts|30-90",
  function:
    "createFilesComponent|f|./agent/extensions/ide/components/files/component.ts|28-60\ncreateSymbolsComponent|f|./agent/extensions/ide/components/symbols/component.ts|35-70",
  method:
    "render|m|./agent/extensions/ide/lib/split-panel/renderer.ts|15-40\nhandleInput|m|./agent/extensions/ide/lib/list-picker.ts|130-165",
  enum: "SymbolType|e|./agent/extensions/ide/components/symbols/types.ts|1-8\nFocusState|e|./agent/extensions/ide/components/changes/state.ts|10-16",
  all: "ListPickerComponent|c|./agent/extensions/ide/lib/list-picker.ts|45-120\ncreateFilesComponent|f|./agent/extensions/ide/components/files/component.ts|28-60\nrender|m|./agent/extensions/ide/lib/split-panel/renderer.ts|15-40\nSymbolType|e|./agent/extensions/ide/components/symbols/types.ts|1-8",
};
function resolveCmOutput(args: string[]): string {
  const typeIdx = args.indexOf("--type");
  if (typeIdx === -1 || typeIdx + 1 >= args.length)
    return SYMBY_TYPE["all"] ?? "";
  const typeFilter = args[typeIdx + 1];
  if (typeFilter === "all") return Object.values(SYMBY_TYPE).join("\n");
  return SYMBY_TYPE[typeFilter] ?? "";
}
interface ExecMock {
  (command: string, args?: string[]): Promise<ExecResult>;
  mock: {
    calls: unknown[][];
  };
}
function createExecMock(options?: { cmStdout?: string }): ExecMock {
  const { cmStdout = "" } = options ?? {};
  return vi.fn().mockImplementation((command: string, args?: string[]) => {
    if (command === "cm")
      return {
        code: 0,
        stdout: cmStdout || resolveCmOutput(args ?? []),
        stderr: "",
      };
    return { code: 1, stdout: "", stderr: `unexpected command: ${command}` };
  });
}
const CTRL_SLASH = "\x1b[27;5;47~";

async function waitForLoaded(
  picker: ReturnType<typeof createSymbolsComponent>,
) {
  await vi.waitFor(() => {
    const lines = picker.render(80);
    return !lines.some((l: string) => l.includes("Loading"));
  });
}

async function cycleFilter(
  picker: ReturnType<typeof createSymbolsComponent>,
  execMock: ExecMock,
  expectedCallCount: number,
) {
  picker.handleInput(CTRL_SLASH);
  await vi.waitFor(() => {
    expect(getCmCalls(execMock)).toHaveLength(expectedCallCount);
  });
}
function getCmCalls(execMock: ExecMock) {
  return execMock.mock.calls.filter(([cmd]) => cmd === "cm");
}

async function createPicker(options?: { cmStdout?: string }): Promise<{
  picker: ReturnType<typeof createSymbolsComponent>;
  execMock: ExecMock;
  tui: ReturnType<typeof createMockTui>;
}> {
  const execMock = createExecMock(options);
  const pi: ExtensionAPI = { ...createMockPi(), exec: execMock };
  const tui = createMockTui();
  const ctx = { cwd: "/tmp/test-project" } as ExtensionContext;
  const picker = createSymbolsComponent({
    pi,
    tui,
    theme,
    keybindings: {} as KeybindingsManager,
    done: vi.fn(),
    initialQuery: "",
    ctx,
  });

  await waitForLoaded(picker);
  await new Promise((r) => setTimeout(r, 200));
  return { picker, execMock, tui };
}

describe("symbols component", () => {
  describe("ctrl+/ cycles symbol type filter and reloads", () => {
    it("cycles through all symbol types on repeated ctrl+/ presses", async (): Promise<void> => {
      const { picker, execMock } = await createPicker({
        cmStdout: "MyClass|c|./src/MyClass.ts|1-20",
      });
      let cmCalls = getCmCalls(execMock);
      expect(cmCalls).toHaveLength(1);

      picker.handleInput(CTRL_SLASH);

      await vi.waitFor(() => {
        expect(getCmCalls(execMock)).toHaveLength(2);
      });

      cmCalls = getCmCalls(execMock);
      expect(cmCalls[1][1]).toContain("--type");
      expect(cmCalls[1][1]).toContain("function");

      picker.handleInput(CTRL_SLASH);

      await vi.waitFor(() => {
        expect(getCmCalls(execMock)).toHaveLength(3);
      });

      cmCalls = getCmCalls(execMock);
      expect(cmCalls[2][1]).toContain("method");
    });

    it("wraps from 'all' back to 'class'", async (): Promise<void> => {
      const { picker, execMock } = await createPicker({
        cmStdout: "Test|f|./src/test.ts|1-5",
      });

      await cycleFilter(picker, execMock, 2);
      await cycleFilter(picker, execMock, 3);
      await cycleFilter(picker, execMock, 4);
      await cycleFilter(picker, execMock, 5);
      await cycleFilter(picker, execMock, 6);
      const cmCalls = getCmCalls(execMock);
      const wrapCall = cmCalls[5];
      expect(wrapCall[1]).toContain("--type");
      expect(wrapCall[1]).toContain("class");
    });

    it("requests re-render after cycling type filter", async (): Promise<void> => {
      const { picker, tui } = await createPicker({
        cmStdout: "TestClass|c|./src/Test.ts|1-5",
      });

      (tui.requestRender as ReturnType<typeof vi.fn>).mockClear();

      picker.handleInput(CTRL_SLASH);

      await vi.waitFor(() => {
        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    it("renders with type filter in title", async (): Promise<void> => {
      // No cmStdout — uses dynamic resolveCmOutput per --type
      const { picker } = await createPicker({});

      expect(picker.render(80).join("\n")).toMatchSnapshot(
        "initial - class filter",
      );

      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80).join("\n")).toMatchSnapshot(
        "after cycle - function filter",
      );

      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80).join("\n")).toMatchSnapshot(
        "after cycle - method filter",
      );

      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80).join("\n")).toMatchSnapshot(
        "after cycle - enum filter",
      );

      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80).join("\n")).toMatchSnapshot(
        "after cycle - all filter",
      );
    });
  });

  describe("symbol type filter in loadItems", () => {
    it("passes the type filter to the query command", async (): Promise<void> => {
      const { execMock } = await createPicker({
        cmStdout: "TestClass|c|./src/Test.ts|1-5",
      });

      expect(execMock).toHaveBeenCalledWith(
        "cm",
        expect.arrayContaining([
          "query",
          "",
          "--format",
          "ai",
          "--type",
          "class",
        ]),
        expect.objectContaining({ cwd: "/tmp/test-project" }),
      );
    });

    it("omits --type when filter is 'all'", async (): Promise<void> => {
      const { picker, execMock } = await createPicker({
        cmStdout: "TestClass|c|./src/Test.ts|1-5",
      });

      await cycleFilter(picker, execMock, 2);
      await cycleFilter(picker, execMock, 3);
      await cycleFilter(picker, execMock, 4);
      await cycleFilter(picker, execMock, 5);
      const cmCalls = getCmCalls(execMock);
      const allCall = cmCalls[4];
      expect(allCall[1]).not.toContain("--type");
    });
  });
});
