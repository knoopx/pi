import { describe, it, expect, vi } from "vitest";
import type {
  ExtensionContext,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import { createSymbolsComponent } from "./component";
import {
  createMockTheme,
  createMockPi,
  createMockTui,
} from "../../lib/test-utils";

const theme = createMockTheme();

const SYMBY_TYPE: Record<string, string> = {
  class: "Animal|c|./src/models.ts|1-30\nPlant|c|./src/models.ts|32-60",
  function:
    "parseInput|f|./src/utils.ts|1-15\nformatOutput|f|./src/utils.ts|17-40",
  method: "render|m|./src/view.ts|5-20\nupdate|m|./src/view.ts|22-35",
  enum: "Status|e|./src/types.ts|1-8\nRole|e|./src/types.ts|10-16",
  all: "Animal|c|./src/models.ts|1-30\nparseInput|f|./src/utils.ts|1-15\nrender|m|./src/view.ts|5-20\nStatus|e|./src/types.ts|1-8",
};

function resolveCmOutput(args: string[]): string {
  const typeIdx = args.indexOf("--type");
  if (typeIdx === -1 || typeIdx + 1 >= args.length)
    return SYMBY_TYPE["all"] ?? "";
  const typeFilter = args[typeIdx + 1];
  // For "all", return everything
  if (typeFilter === "all") return Object.values(SYMBY_TYPE).join("\n");
  return SYMBY_TYPE[typeFilter] ?? "";
}

function createExecMock(options?: {
  cmStdout?: string;
}): ReturnType<typeof vi.fn> {
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
  execMock: ReturnType<typeof vi.fn>,
  expectedCallCount: number,
) {
  picker.handleInput(CTRL_SLASH);
  await vi.waitFor(() => {
    expect(getCmCalls(execMock)).toHaveLength(expectedCallCount);
  });
}

function getCmCalls(execMock: ReturnType<typeof vi.fn>) {
  return execMock.mock.calls.filter(([cmd]) => cmd === "cm");
}

async function createPicker(options?: { cmStdout?: string }): Promise<{
  picker: ReturnType<typeof createSymbolsComponent>;
  execMock: ReturnType<typeof vi.fn>;
  tui: ReturnType<typeof createMockTui>;
}> {
  const execMock = createExecMock(options);
  // File previews use fs.readFile directly, no cat mock needed
  const pi = { ...createMockPi(), exec: execMock } as unknown as any;
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
  return { picker, execMock, tui };
}

describe("symbols component", () => {
  describe("ctrl+/ cycles symbol type filter and reloads", () => {
    it("cycles through all symbol types on repeated ctrl+/ presses", async () => {
      const { picker, execMock } = await createPicker({
        cmStdout: "MyClass|c|./src/MyClass.ts|1-20",
      });

      let cmCalls = getCmCalls(execMock);
      expect(cmCalls).toHaveLength(1);

      // Press ctrl+/ - should cycle to "function" and reload
      picker.handleInput(CTRL_SLASH);

      await vi.waitFor(() => {
        expect(getCmCalls(execMock)).toHaveLength(2);
      });

      cmCalls = getCmCalls(execMock);
      expect(cmCalls[1][1]).toContain("--type");
      expect(cmCalls[1][1]).toContain("function");

      // Press ctrl+/ again - should cycle to "method" and reload
      picker.handleInput(CTRL_SLASH);

      await vi.waitFor(() => {
        expect(getCmCalls(execMock)).toHaveLength(3);
      });

      cmCalls = getCmCalls(execMock);
      expect(cmCalls[2][1]).toContain("method");
    });

    it("wraps from 'all' back to 'class'", async () => {
      const { picker, execMock } = await createPicker({
        cmStdout: "Test|f|./src/test.ts|1-5",
      });

      // Cycle through all filter types and wrap back to class
      await cycleFilter(picker, execMock, 2); // class -> function
      await cycleFilter(picker, execMock, 3); // function -> method
      await cycleFilter(picker, execMock, 4); // method -> enum
      await cycleFilter(picker, execMock, 5); // enum -> all
      await cycleFilter(picker, execMock, 6); // all -> class (wraps)

      const cmCalls = getCmCalls(execMock);
      const wrapCall = cmCalls[5];
      expect(wrapCall[1]).toContain("--type");
      expect(wrapCall[1]).toContain("class");
    });

    it("requests re-render after cycling type filter", async () => {
      const {
        picker,
        execMock: _em,
        tui,
      } = await createPicker({
        cmStdout: "TestClass|c|./src/Test.ts|1-5",
      });

      (tui.requestRender as ReturnType<typeof vi.fn>).mockClear();

      // Press ctrl+/
      picker.handleInput(CTRL_SLASH);

      // Wait for reload to trigger requestRender
      await vi.waitFor(() => {
        expect(tui.requestRender).toHaveBeenCalled();
      });
    });

    it("renders with type filter in title", async () => {
      // No cmStdout — uses dynamic resolveCmOutput per --type
      const { picker } = await createPicker({});

      expect(picker.render(80)).toMatchSnapshot("initial - class filter");

      // Cycle to function, wait for reload
      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80)).toMatchSnapshot(
        "after cycle - function filter",
      );

      // Cycle to method, wait for reload
      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80)).toMatchSnapshot("after cycle - method filter");

      // Cycle to enum, wait for reload
      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80)).toMatchSnapshot("after cycle - enum filter");

      // Cycle to all (shown as *), wait for reload
      picker.handleInput(CTRL_SLASH);
      await waitForLoaded(picker);
      expect(picker.render(80)).toMatchSnapshot("after cycle - all filter");
    });
  });

  describe("symbol type filter in loadItems", () => {
    it("passes the type filter to the query command", async () => {
      const { picker: _p, execMock } = await createPicker({
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

    it("omits --type when filter is 'all'", async () => {
      const { picker, execMock } = await createPicker({
        cmStdout: "TestClass|c|./src/Test.ts|1-5",
      });

      // Cycle through to "all" (class -> function -> method -> enum -> all)
      await cycleFilter(picker, execMock, 2);
      await cycleFilter(picker, execMock, 3);
      await cycleFilter(picker, execMock, 4);
      await cycleFilter(picker, execMock, 5);

      // The "all" cm call should NOT contain --type
      const cmCalls = getCmCalls(execMock);
      const allCall = cmCalls[4];
      expect(allCall[1]).not.toContain("--type");
    });
  });
});
