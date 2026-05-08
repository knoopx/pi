import { describe, expect, it, vi } from "vitest";

const previewContents: Record<string, string> = {
  "src/app.ts":
    "const x = 42;\n\n// This is a comment\nfunction hello() {\n  return x;\n}\n",
  "src/a.ts": "foo bar\nbaz qux\n",
  "src/b.ts": "const y = 10;\nexport function test() {}\n",
  "src/c.ts": "hello world\nnice day\n",
  "lib/utils.ts": "export function foo(): void {}\nexport const BAR = 42;\n",
  "src/main.ts": "import { foo } from './utils';\nfoo();\n",
};

vi.mock("../../lib/file-preview", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/file-preview")>();
  return {
    ...actual,
    loadPreviewFromPath: async (
      _cwd: string,
      filePath: string,
      _theme: unknown,
    ) => {
      const content = previewContents[filePath];
      if (!content) return [];
      return content.split("\n");
    },
  };
});

import { createSearchComponent } from "./component";
import type { SearchResult } from "./types";
import {
  createMockPi,
  createMockTui,
  createMockTheme,
} from "../../lib/test-utils";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";

function buildRgOutput(items: SearchResult[]): string {
  const lines: string[] = [];
  for (const item of items) {
    lines.push(
      JSON.stringify({
        type: "path",
        data: { path: { text: item.path } },
      }),
    );
    lines.push(
      JSON.stringify({
        type: "match",
        data: {
          path: { text: item.path },
          lines: { text: item.lineText },
          line_number: item.lineNum,
          column: item.colNum,
          submatches: [
            {
              match: { text: item.matchedText },
              start: 0,
              end: item.matchedText.length,
            },
          ],
        },
      }),
    );
  }
  return lines.join("\n");
}

async function waitForLoaded(component: {
  render: (cols: number) => string[];
}): Promise<void> {
  await vi.waitFor(() => {
    const lines = component.render(80);
    return !lines.some((l: string) => l.includes("Loading"));
  });
  await new Promise((r) => setTimeout(r, 50));
}

async function createActionTest(
  keyChar: string,
  assertResult?: (result: SearchResult) => void,
): Promise<{
  component: ReturnType<typeof createSearchComponent>;
  done: ReturnType<typeof vi.fn>;
}> {
  const done = vi.fn();
  const tui = createMockTui();
  const theme = createMockTheme();
  const keybindings = {} as KeybindingsManager;

  const component = createSearchComponent({
    pi: createMockPi({
      exec: vi.fn().mockResolvedValue({
        code: 0,
        stdout: buildRgOutput([
          {
            id: "src/app.ts:1:5",
            label: "const x = 42;",
            path: "src/app.ts",
            lineNum: 1,
            colNum: 5,
            lineText: "const x = 42;\n",
            matchedText: "42",
          },
        ]),
        stderr: "",
      }),
    }),
    tui,
    theme,
    keybindings,
    done,
    initialQuery: "",
    ctx: { cwd: "/test" } as never,
  });
  await waitForLoaded(component);

  component.handleInput(keyChar);

  if (assertResult) {
    await vi.waitFor(
      () => {
        expect(done).toHaveBeenCalled();
      },
      { timeout: 1000 },
    );
    const result = done.mock.calls[0][0] as SearchResult | null;
    expect(result).not.toBeNull();
    assertResult(result!);
  }

  return { component, done };
}

function createComponent(overrides?: {
  rgOutput?: SearchResult[];
  initialQuery?: string;
}): {
  component: ReturnType<typeof createSearchComponent>;
  execMock: ReturnType<typeof vi.fn>;
} {
  const tui = createMockTui();
  const theme = createMockTheme();
  const keybindings = {} as KeybindingsManager;

  const rgOutput = overrides?.rgOutput ?? [];
  const execMock = vi.fn().mockResolvedValue({
    code: rgOutput.length > 0 ? 0 : 1,
    stdout: buildRgOutput(rgOutput),
    stderr: "",
  });

  const pi = createMockPi({ exec: execMock });

  const component = createSearchComponent({
    pi,
    tui,
    theme,
    keybindings,
    done: () => {},
    initialQuery: overrides?.initialQuery ?? "",
    ctx: { cwd: "/test" } as never,
  });

  return { component, execMock };
}

describe("createSearchComponent — rendering", () => {
  it("renders empty state with no results", async () => {
    const { component } = createComponent({ rgOutput: [] });
    await waitForLoaded(component);

    const result = component.render(80);
    expect(result.join("\n")).toMatchSnapshot();
  });

  it("renders single result with preview", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
    });
    await waitForLoaded(component);

    const result = component.render(80);
    expect(result.join("\n")).toMatchSnapshot();
  });

  it("renders multiple results", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/a.ts:1:0",
          label: "foo bar",
          path: "src/a.ts",
          lineNum: 1,
          colNum: 0,
          lineText: "foo bar\n",
          matchedText: "foo",
        },
        {
          id: "src/b.ts:2:0",
          label: "baz qux",
          path: "src/b.ts",
          lineNum: 2,
          colNum: 0,
          lineText: "baz qux\n",
          matchedText: "baz",
        },
        {
          id: "src/c.ts:3:0",
          label: "hello world",
          path: "src/c.ts",
          lineNum: 3,
          colNum: 0,
          lineText: "hello world\n",
          matchedText: "hello",
        },
      ],
    });
    await waitForLoaded(component);

    const result = component.render(80);
    expect(result.join("\n")).toMatchSnapshot();
  });

  it("renders search with query in title", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
      initialQuery: "const",
    });
    await waitForLoaded(component);

    const result = component.render(80);
    expect(result.join("\n")).toMatchSnapshot();
  });

  it("renders search with highlighted match text", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const hello world = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const hello world = 42;\n",
          matchedText: "hello",
        },
      ],
    });
    await waitForLoaded(component);

    const result = component.render(80);
    expect(result.join("\n")).toMatchSnapshot();
  });

  it("renders across multiple files with same query", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "lib/utils.ts:1:0",
          label: "export function foo(): void {}",
          path: "lib/utils.ts",
          lineNum: 1,
          colNum: 0,
          lineText: "export function foo(): void {}\n",
          matchedText: "foo",
        },
        {
          id: "src/main.ts:2:0",
          label: "import { foo } from './utils';",
          path: "src/main.ts",
          lineNum: 2,
          colNum: 0,
          lineText: "foo();\n",
          matchedText: "foo",
        },
      ],
    });
    await waitForLoaded(component);

    const result = component.render(80);
    expect(result.join("\n")).toMatchSnapshot();
  });

  it("renders correctly at narrow width", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
    });
    await waitForLoaded(component);

    const result = component.render(40);
    expect(result.join("\n")).toMatchSnapshot();
  });

  it("renders correctly at wide width", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
    });
    await waitForLoaded(component);

    const result = component.render(120);
    expect(result.join("\n")).toMatchSnapshot();
  });
});

describe("createSearchComponent — behavior", () => {
  it("calls exec with correct rg command for plain query", async () => {
    const { component, execMock } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
      initialQuery: "foo",
    });
    await waitForLoaded(component);

    expect(execMock).toHaveBeenCalledWith(
      "rg",
      expect.arrayContaining(["--json"]),
      expect.anything(),
    );
  });

  it("calls exec with -E flag for regex prefix", async () => {
    const { component, execMock } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
      initialQuery: "regex:\\d+",
    });
    await waitForLoaded(component);

    expect(execMock).toHaveBeenCalledWith(
      "rg",
      expect.arrayContaining(["-E", "\\d+"]),
      expect.anything(),
    );
  });

  it("calls exec with -F flag for fixed prefix", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
      initialQuery: "fixed:const",
    });
    await waitForLoaded(component);

    expect(component.render(80)).toBeDefined();
  });

  it("calls done with null on escape key", async () => {
    const done = vi.fn();
    const tui = createMockTui();
    const theme = createMockTheme();
    const keybindings = {} as KeybindingsManager;

    const component = createSearchComponent({
      pi: createMockPi(),
      tui,
      theme,
      keybindings,
      done,
      initialQuery: "",
      ctx: { cwd: "/test" } as never,
    });
    await waitForLoaded(component);

    component.handleInput("\x1b");

    expect(done).toHaveBeenCalledWith(null);
  });

  it("calls done with result on edit action (ctrl+e)", async () => {
    const { component } = await createActionTest(
      String.fromCharCode(5),
      (result) => {
        expect(result.path).toBe("src/app.ts");
        expect(result.lineNum).toBe(1);
      },
    );

    expect(component).toBeDefined();
  });

  it("calls done with result on insert action (ctrl+i)", async () => {
    await createActionTest(String.fromCharCode(9));
  });

  it("renders consistent output on repeated renders", async () => {
    const { component } = createComponent({
      rgOutput: [
        {
          id: "src/app.ts:1:5",
          label: "const x = 42;",
          path: "src/app.ts",
          lineNum: 1,
          colNum: 5,
          lineText: "const x = 42;\n",
          matchedText: "42",
        },
      ],
    });
    await waitForLoaded(component);

    const result1 = component.render(80);
    const result2 = component.render(80);

    expect(result1).toEqual(result2);
  });
});
