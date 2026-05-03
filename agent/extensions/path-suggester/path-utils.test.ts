import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "node:child_process";
import type { ExecFileOptions } from "node:child_process";
import {
  buildFileList,
  buildSymbolText,
  parseCmMapOutput,
  parseSymbolTokens,
} from "./path-utils";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(childProcess.execFile);

async function runBuildFileList(
  stdout: string,
): Promise<ReturnType<typeof buildFileList>> {
  execFileMock.mockImplementation((_, __, ___, cb) => {
    if (cb) cb(null, stdout, "");
    const mockProcess = {
      on(_event: string, _handler: (...args: unknown[]) => void) {},
    };
    return mockProcess as unknown as ReturnType<typeof childProcess.execFile>;
  });
  return buildFileList("/project");
}

describe("parseCmMapOutput", () => {
  it("parses a single simple entry", () => {
    const output = "./src/main.ts|typescript|764|f:main@1-2";
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      path: "./src/main.ts",
      lang: "typescript",
      symbolsCount: 764,
      symbols: "f:main@1-2",
    });
  });

  it("parses multiple entries from multi-line output", () => {
    const output = [
      "./src/a.ts|typescript|100|f:foo@1-5",
      "./src/b.ts|typescript|200|f:bar@1-10,m:baz@12-20",
    ].join("\n");
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("./src/a.ts");
    expect(result[1].path).toBe("./src/b.ts");
    expect(result[1].symbols).toBe("f:bar@1-10,m:baz@12-20");
  });

  it("parses entries with pipes in symbol data (parts >= 4)", () => {
    // If cm outputs more than 4 pipe-separated parts, extra parts are joined
    const output = "./src/a.ts|typescript|100|f:foo@1-5|extra";
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0].symbols).toBe("f:foo@1-5|extra");
  });

  it("skips lines with fewer than 4 pipe-separated parts", () => {
    const output = [
      "incomplete|line",
      "./src/a.ts|typescript|100|f:foo@1-5",
      "",
    ].join("\n");
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("./src/a.ts");
  });

  it("parses real cm output with nested test symbols", () => {
    const output =
      "./agent/extensions/ide/components/pull-requests/helpers.test.ts|typescript|5412|f:anonymous@15-15,f:anonymous@16-16,f:describe:getPrIcon@19-34";
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe(
      "./agent/extensions/ide/components/pull-requests/helpers.test.ts",
    );
    expect(result[0].lang).toBe("typescript");
    expect(result[0].symbolsCount).toBe(5412);
    expect(result[0].symbols).toContain("f:describe:getPrIcon@19-34");
  });

  it("parses markdown headings and code blocks", () => {
    const output =
      "./agent/skills/gtkx/references/styling.md|markdown|1755|h:Styling and CSS@1-2,h:Styling and CSS > Overview@5-6,cb:Overview@[code: tsx]@9-21";
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0].lang).toBe("markdown");
    expect(result[0].symbolsCount).toBe(1755);
  });

  it("parses interface and type symbols", () => {
    const output =
      "./agent/extensions/guardrails/types.ts|typescript|391|if:GuardrailsRule@1-14,if:GuardrailsGroup@15-22";
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0].symbols).toBe(
      "if:GuardrailsRule@1-14,if:GuardrailsGroup@15-22",
    );
  });

  it("parses class and method symbols", () => {
    const output =
      "./agent/extensions/ide/components/workspaces/view.ts|typescript|2631|c:WorkspaceView@9-84,m:constructor@10-17,m:render@19-81";
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(1);
    expect(result[0].symbols).toContain("c:WorkspaceView@9-84");
    expect(result[0].symbols).toContain("m:constructor@10-17");
  });

  it("returns empty array for empty string", () => {
    expect(parseCmMapOutput("")).toEqual([]);
  });

  it("handles file with no symbols (empty symbols field)", () => {
    const output =
      "./agent/extensions/skill-reminder/vitest.config.ts|typescript|171";
    const result = parseCmMapOutput(output);
    expect(result).toHaveLength(0); // only 3 parts, need >= 4
  });

  it("preserves relative paths with ./ prefix", () => {
    const output =
      "./agent/extensions/gh/gist-tools.ts|typescript|10665|f:createGistResult@22-30";
    const result = parseCmMapOutput(output);
    expect(result[0].path).toBe("./agent/extensions/gh/gist-tools.ts");
  });

  it("parses deeply nested paths", () => {
    const output =
      "./agent/extensions/ide/lib/split-panel/border.ts|typescript|12396|f:createBorderFn@92-96";
    const result = parseCmMapOutput(output);
    expect(result[0].path).toBe(
      "./agent/extensions/ide/lib/split-panel/border.ts",
    );
  });

  it("parses large symbolsCount values", () => {
    const output =
      "./agent/extensions/ide/components/workspaces/view.ts|typescript|2631|f:test@1-5";
    const result = parseCmMapOutput(output);
    expect(result[0].symbolsCount).toBe(2631);
  });
});

describe("parseSymbolTokens", () => {
  it("parses a single function symbol", () => {
    const tokens = parseSymbolTokens("f:main@file.ts:10");
    expect(tokens).toEqual([{ type: "f", name: "main" }]);
  });

  it("parses multiple symbols separated by commas", () => {
    const tokens = parseSymbolTokens("f:foo@1-5,f:bar@6-10,m:baz@12-20");
    expect(tokens).toEqual([
      { type: "f", name: "foo" },
      { type: "f", name: "bar" },
      { type: "m", name: "baz" },
    ]);
  });

  it("parses symbols with colons in the name (nested test names)", () => {
    const tokens = parseSymbolTokens("f:describe:getPrIcon@19-34");
    expect(tokens).toEqual([{ type: "f", name: "describe:getPrIcon" }]);
  });

  it("parses symbols with colons in path info after @", () => {
    const tokens = parseSymbolTokens("f:main@file.ts:10-20");
    expect(tokens).toEqual([{ type: "f", name: "main" }]);
  });

  it("skips tokens with no colon (no type)", () => {
    const tokens = parseSymbolTokens("plainText,f:valid@1-5");
    expect(tokens).toEqual([{ type: "f", name: "valid" }]);
  });

  it("skips tokens starting with colon (empty type)", () => {
    const tokens = parseSymbolTokens(":name@1-5,f:valid@1-5");
    expect(tokens).toEqual([{ type: "f", name: "valid" }]);
  });

  it("parses symbols with @ separator correctly", () => {
    // @ marks the start of file path info, not part of the symbol
    const tokens = parseSymbolTokens("f:main@file.ts:10");
    expect(tokens[0].name).toBe("main");
  });

  it("parses symbols without @ (only type:name)", () => {
    const tokens = parseSymbolTokens("f:name");
    expect(tokens).toEqual([{ type: "f", name: "name" }]);
  });

  it("parses code block symbols with brackets in name", () => {
    const tokens = parseSymbolTokens("cb:Overview > [code: tsx]@9-21");
    expect(tokens).toEqual([{ type: "cb", name: "Overview > [code: tsx]" }]);
  });

  it("parses symbols with hyphens in name", () => {
    const tokens = parseSymbolTokens("f:get-data@1-5");
    expect(tokens).toEqual([{ type: "f", name: "get-data" }]);
  });

  it("parses symbols with dots in name", () => {
    const tokens = parseSymbolTokens("f:obj.method@1-5");
    expect(tokens).toEqual([{ type: "f", name: "obj.method" }]);
  });

  it("parses symbols with underscores in name", () => {
    const tokens = parseSymbolTokens("f:_private@1-5");
    expect(tokens).toEqual([{ type: "f", name: "_private" }]);
  });

  it("parses symbols with special characters", () => {
    const tokens = parseSymbolTokens(
      "f:test:returns draft icon for drafts@20-23",
    );
    expect(tokens[0].name).toBe("test:returns draft icon for drafts");
  });

  it("handles empty string", () => {
    expect(parseSymbolTokens("")).toEqual([]);
  });

  it("handles only commas", () => {
    expect(parseSymbolTokens(",,")).toEqual([]);
  });

  it("parses symbols with line ranges (hyphen in line number)", () => {
    const tokens = parseSymbolTokens("f:main@1-5");
    expect(tokens).toEqual([{ type: "f", name: "main" }]);
  });

  it("parses symbols with unicode characters", () => {
    const tokens = parseSymbolTokens("f:café@1-5");
    expect(tokens).toEqual([{ type: "f", name: "café" }]);
  });

  it("parses symbols with spaces in name", () => {
    const tokens = parseSymbolTokens("f:test: returns something @1-5");
    expect(tokens[0].name).toBe("test: returns something ");
  });

  it("parses all real symbol type abbreviations", () => {
    const tokens = parseSymbolTokens(
      "f:fn@1,c:class@2,m:method@3,if:interface@4,ty:type@5,h:heading@6,cb:codeblock@7",
    );
    expect(tokens.map((t) => t.type)).toEqual([
      "f",
      "c",
      "m",
      "if",
      "ty",
      "h",
      "cb",
    ]);
  });

  it("parses symbols with anonymous name", () => {
    const tokens = parseSymbolTokens("f:anonymous@1-5");
    expect(tokens).toEqual([{ type: "f", name: "anonymous" }]);
  });

  it("parses symbols with empty name", () => {
    const tokens = parseSymbolTokens("f:@1-5");
    expect(tokens).toEqual([{ type: "f", name: "" }]);
  });

  it("parses symbols with only type and @", () => {
    const tokens = parseSymbolTokens("function:name@");
    expect(tokens).toEqual([{ type: "function", name: "name" }]);
  });

  it("parses deeply nested describe/test names from real output", () => {
    const input =
      "f:describe:when cost is very large@152-157,f:test:then returns rounded to integer@153-156";
    const tokens = parseSymbolTokens(input);
    expect(tokens).toEqual([
      { type: "f", name: "describe:when cost is very large" },
      { type: "f", name: "test:then returns rounded to integer" },
    ]);
  });

  it("parses symbols with numeric-only line numbers", () => {
    const tokens = parseSymbolTokens("f:main@123");
    expect(tokens).toEqual([{ type: "f", name: "main" }]);
  });

  it("parses symbols with very large line numbers", () => {
    const tokens = parseSymbolTokens("f:main@999999");
    expect(tokens).toEqual([{ type: "f", name: "main" }]);
  });
});

describe("buildSymbolText", () => {
  it("returns empty string for entry with no symbols", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 0,
      symbols: "",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("maps type abbreviations to full names", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 7,
      symbols: "f:fn@1,c:class@2,m:method@3,if:iface@4,ty:type@5,h:h@6,cb:cb@7",
    };
    const result = buildSymbolText(entry);
    expect(result).toBe(
      "fn (function), class (class), method (method), iface (interface), type (type), h (heading), cb (codeblock)",
    );
  });

  it("uses raw type when not in typeMap", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "unknown:type@1-5",
    };
    expect(buildSymbolText(entry)).toBe("type (unknown)");
  });

  it("deduplicates symbols with same type:name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 3,
      symbols: "f:main@1-5,f:main@6-10,f:main@11-15",
    };
    expect(buildSymbolText(entry)).toBe("main (function)");
  });

  it("skips anonymous symbols", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 2,
      symbols: "f:anonymous@1-5,f:real@6-10",
    };
    expect(buildSymbolText(entry)).toBe("real (function)");
  });

  it("truncates output at 600 characters", () => {
    const symbols = Array.from(
      { length: 50 },
      (_, i) => `f:func${i}@${i}-${i}`,
    ).join(",");
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 50,
      symbols,
    };
    const result = buildSymbolText(entry);
    expect(result.length).toBeLessThanOrEqual(600);
    // Not all 50 symbols fit in 600 chars
    expect(result.split(", ").length).toBeLessThan(50);
  });

  it("handles real-world large symbol list", () => {
    const entry = {
      path: "./agent/extensions/ide/components/workspaces/view.ts",
      lang: "typescript",
      symbolsCount: 2631,
      symbols:
        "c:WorkspaceView@9-84,m:constructor@10-17,m:render@19-81,m:invalidate@83-83",
    };
    const result = buildSymbolText(entry);
    expect(result).toBe(
      "WorkspaceView (class), constructor (method), render (method), invalidate (method)",
    );
  });

  it("handles symbols with nested describe/test names", () => {
    const entry = {
      path: "./agent/extensions/ide/components/pull-requests/helpers.test.ts",
      lang: "typescript",
      symbolsCount: 5412,
      symbols:
        "f:describe:getPrIcon@19-34,f:test:returns draft icon for drafts@20-23",
    };
    const result = buildSymbolText(entry);
    expect(result).toContain("getPrIcon (function)");
    expect(result).toContain("test:returns draft icon for drafts (function)");
  });

  it("handles markdown headings with nested structure", () => {
    const entry = {
      path: "./agent/skills/gtkx/references/styling.md",
      lang: "markdown",
      symbolsCount: 1755,
      symbols: "h:Styling and CSS@1-2,h:Styling and CSS > Overview@5-6",
    };
    const result = buildSymbolText(entry);
    expect(result).toBe(
      "Styling and CSS (heading), Styling and CSS > Overview (heading)",
    );
  });

  it("handles interface symbols", () => {
    const entry = {
      path: "./agent/extensions/guardrails/types.ts",
      lang: "typescript",
      symbolsCount: 391,
      symbols: "if:GuardrailsRule@1-14,if:GuardrailsGroup@15-22",
    };
    const result = buildSymbolText(entry);
    expect(result).toBe(
      "GuardrailsRule (interface), GuardrailsGroup (interface)",
    );
  });

  it("handles symbols with no path info after @", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "f:name@",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with empty line number after @:", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "f:name@file.ts:",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with negative line number", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "f:name@file.ts:-10",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with decimal line number", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "f:name@file.ts:10.5",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });
});

describe("buildFileList", () => {
  beforeEach(() => {
    execFileMock.mockReset();
    execFileMock.mockImplementation((_, __, ___, cb) => {
      if (cb) cb(new Error("not found"), "", "");
      return { on() {} } as unknown as ReturnType<typeof childProcess.execFile>;
    });
  });

  it("resolves with empty array when cm command fails", async () => {
    const result = await buildFileList("/project");
    expect(result).toEqual([]);
  });

  it("resolves with empty array when stdout is empty", async () => {
    const result = await runBuildFileList("");
    expect(result).toEqual([]);
  });

  it("passes correct arguments to cm", async () => {
    execFileMock.mockImplementation(
      (
        cmd: string,
        args: readonly string[] | null | undefined,
        _opts: ExecFileOptions | null | undefined,
        cb,
      ) => {
        expect(cmd).toBe("cm");
        expect(args).toContain("map");
        expect(args).toContain("/project");
        expect(args).toContain("--level");
        expect(args).toContain("3");
        expect(args).toContain("--format");
        expect(args).toContain("ai");
        if (cb) cb(null, "", "");
        return { on() {} } as unknown as ReturnType<
          typeof childProcess.execFile
        >;
      },
    );

    await buildFileList("/project");
  });

  it("parses real cm output format", async () => {
    const realOutput = [
      "./agent/skills/gtkx/references/styling.md|markdown|1755|h:Styling and CSS@1-2,h:Overview@5-6,cb:Code@[code: tsx]@9-21",
      "./agent/extensions/gh/gist-tools.ts|typescript|10665|f:createGistResult@22-30,f:executeListGists@112-134",
      "./agent/shared/rendering/text.ts|typescript|764|f:wrapPlain@1-27",
    ].join("\n");

    const result = await runBuildFileList(realOutput);
    expect(result).toHaveLength(3);

    expect(result[0].path).toBe("./agent/skills/gtkx/references/styling.md");
    expect(result[0].lang).toBe("markdown");
    expect(result[0].symbolsCount).toBe(1755);
    expect(result[0].symbols).toContain("h:Styling and CSS@1-2");

    expect(result[1].path).toBe("./agent/extensions/gh/gist-tools.ts");
    expect(result[1].lang).toBe("typescript");
    expect(result[1].symbolsCount).toBe(10665);

    expect(result[2].path).toBe("./agent/shared/rendering/text.ts");
  });

  it("handles files with no symbols (3 pipe-separated parts only)", async () => {
    const output =
      "./agent/extensions/skill-reminder/vitest.config.ts|typescript|171";
    const result = await runBuildFileList(output);
    expect(result).toEqual([]); // needs >= 4 parts
  });

  it("handles mixed valid and invalid lines", async () => {
    const output = [
      "bad line no pipes",
      "./src/a.ts|typescript|100|f:foo@1-5",
      "incomplete|only|two",
      "./src/b.ts|typescript|200|f:bar@1-10,m:baz@12-20",
    ].join("\n");
    const result = await runBuildFileList(output);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("./src/a.ts");
    expect(result[1].path).toBe("./src/b.ts");
  });

  it("handles timeout (err is not null)", async () => {
    execFileMock.mockImplementation((_, __, ___, cb) => {
      if (cb) cb(new Error("timeout"), "", "");
      return { on() {} } as unknown as ReturnType<typeof childProcess.execFile>;
    });
    const result = await buildFileList("/project");
    expect(result).toEqual([]);
  });
});
