import { describe, it, expect, vi, beforeEach } from "vitest";
import * as childProcess from "node:child_process";
import type { ExecFileOptions } from "node:child_process";
import { buildFileList, buildSymbolText } from "./path-utils";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const execFileMock = vi.mocked(childProcess.execFile);

async function runBuildFileList(
  stdout: string,
): Promise<ReturnType<typeof buildFileList>> {
  execFileMock.mockImplementation((_, __, ___, cb) => {
    if (cb) cb(null, stdout, "");
    return { on() {} } as any;
  });
  return buildFileList("/project");
}

describe("buildFileList", () => {
  beforeEach(() => {
    execFileMock.mockReset();
    execFileMock.mockImplementation((_, __, ___, cb) => {
      if (cb) cb(new Error("not found"), "", "");
      return { on() {} } as any;
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

  it("resolves with parsed entries on success", async () => {
    const output = `src/main.ts|typescript|3|function:main@file.ts:10
src/utils.ts|typescript|2|function:parse@file.ts:20,function:format@file.ts:30
`;

    const result = await runBuildFileList(output);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("src/main.ts");
    expect(result[0].lang).toBe("typescript");
    expect(result[0].symbolsCount).toBe(3);
    expect(result[1].path).toBe("src/utils.ts");
  });

  it("skips header and metadata lines", async () => {
    const output = `[INFO] Starting scan
LANGS: typescript
FILES: 2
a.ts|typescript|1|function:foo@file.ts:10
`;

    const result = await runBuildFileList(output);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("a.ts");
  });

  it("handles lines with fewer than 4 parts", async () => {
    const output = `incomplete_line
`;

    const result = await runBuildFileList(output);
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
        return { on() {} } as any;
      },
    );

    await buildFileList("/project");
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

  it("parses single symbol", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:main@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("main (function)");
  });

  it("parses multiple symbols", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 2,
      symbols: "function:main@file.ts:10,function:parse@file.ts:20",
    };
    expect(buildSymbolText(entry)).toBe("main (function), parse (function)");
  });

  it("handles mixed symbol types", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 3,
      symbols: "function:main@file.ts:10,class:App@file.ts:20,var:x@file.ts:30",
    };
    expect(buildSymbolText(entry)).toBe(
      "main (function), App (class), x (variable)",
    );
  });

  it("handles symbols with colons in type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:main@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("main (function)");
  });

  it("returns empty string for undefined symbols", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 0,
      symbols: "",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with no type info", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles empty symbol name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("(function)");
  });

  it("handles unknown symbol type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "unknown:type@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("type (unknown)");
  });

  it("handles symbols with special characters in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:get-data@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("get-data (function)");
  });

  it("handles multiple symbols with special characters", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 2,
      symbols: "function:get-data@file.ts:10,class:user-info@file.ts:20",
    };
    expect(buildSymbolText(entry)).toBe(
      "get-data (function), user-info (class)",
    );
  });

  it("handles symbols with numbers in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:parse2@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("parse2 (function)");
  });

  it("handles symbols with underscores in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:_private@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("_private (function)");
  });

  it("handles symbols with dots in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:obj.method@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("obj.method (function)");
  });

  it("handles symbols with @ symbol in path", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:main@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("main (function)");
  });

  it("handles symbols with multiple @ symbols", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:main@file.ts:10,extra",
    };
    expect(buildSymbolText(entry)).toBe("main (function)");
  });

  it("handles symbols with line range", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:main@file.ts:10-20",
    };
    expect(buildSymbolText(entry)).toBe("main (function)");
  });

  it("handles symbols with empty type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: ":name@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("name (unknown)");
  });

  it("handles symbols with empty name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("(function)");
  });

  it("handles symbols with no @ separator", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with only type and no name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:",
    };
    expect(buildSymbolText(entry)).toBe("(function)");
  });

  it("handles symbols with multiple colons in type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "namespace:foo:bar@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("foo (namespace)");
  });

  it("handles symbols with no path info", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with only line number", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@file.ts:",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with empty line number", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@file.ts:",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with negative line number", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@file.ts:-10",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with very large line number", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@file.ts:999999",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with decimal line number", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@file.ts:10.5",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with unicode characters in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:café@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("café (function)");
  });

  it("handles symbols with emoji in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:🚀launch@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("🚀launch (function)");
  });

  it("handles symbols with spaces in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my function (function)");
  });

  it("handles symbols with tabs in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my\tfunction@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my\tfunction (function)");
  });

  it("handles symbols with newlines in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my\nfunction@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my\nfunction (function)");
  });

  it("handles symbols with carriage return in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my\rfunction@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my\rfunction (function)");
  });

  it("handles symbols with null byte in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my\0function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with backslash in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my\\function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my\\function (function)");
  });

  it("handles symbols with forward slash in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my/function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my/function (function)");
  });

  it("handles symbols with pipe in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my|function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with comma in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my,function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with semicolon in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my;function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with quote in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: 'function:my"function@file.ts:10',
    };
    expect(buildSymbolText(entry)).toBe('my"function (function)');
  });

  it("handles symbols with single quote in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my'function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my'function (function)");
  });

  it("handles symbols with backtick in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my`function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my`function (function)");
  });

  it("handles symbols with dollar sign in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:$myfunction@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("$myfunction (function)");
  });

  it("handles symbols with exclamation mark in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my!function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my!function (function)");
  });

  it("handles symbols with question mark in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my?function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my?function (function)");
  });

  it("handles symbols with asterisk in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my*function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with plus sign in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my+function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my+function (function)");
  });

  it("handles symbols with equals sign in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my=function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my=function (function)");
  });

  it("handles symbols with hash in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my#function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my#function (function)");
  });

  it("handles symbols with percent in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my%function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with caret in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my^function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with tilde in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my~function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with less than in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my<function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with greater than in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my>function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with open paren in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my(function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with close paren in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my)function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with open bracket in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my[function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with close bracket in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my]function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with open brace in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my{function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with close brace in name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:my}function@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("my (function)");
  });

  it("handles symbols with single character name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:a@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("a (function)");
  });

  it("handles symbols with very long name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: `function:${"a".repeat(100)}@file.ts:10`,
    };
    expect(buildSymbolText(entry)).toBe(`${"a".repeat(100)} (function)`);
  });

  it("handles symbols with all known types", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 9,
      symbols:
        "function:f@file.ts:1,class:c@file.ts:2,method:m@file.ts:3,var:v@file.ts:4,const:cv@file.ts:5,typealias:ta@file.ts:6,enum:e@file.ts:7,interface:i@file.ts:8,property:p@file.ts:9",
    };
    expect(buildSymbolText(entry)).toBe(
      "f (function), c (class), m (method), v (variable), cv (constant), ta (type alias), e (enum), i (interface), p (property)",
    );
  });

  it("handles symbols with unknown type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "unknown_type:name@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("name (unknown_type)");
  });

  it("handles symbols with case-sensitive type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "FUNCTION:name@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("name (FUNCTION)");
  });

  it("handles symbols with mixed case type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "FunCtIoN:name@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("name (FunCtIoN)");
  });

  it("handles symbols with empty file path", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with only colon separator", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name:",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with no separator at all", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with only type", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:",
    };
    expect(buildSymbolText(entry)).toBe("(function)");
  });

  it("handles symbols with type and colon but no name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:@",
    };
    expect(buildSymbolText(entry)).toBe("(function)");
  });

  it("handles symbols with type and colon but empty name", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("(function)");
  });

  it("handles symbols with spaces around colon separator", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function : name@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe(" name (function )");
  });

  it("handles symbols with multiple colons in type part", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "namespace:foo:bar:name@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("foo (namespace)");
  });

  it("handles symbols with trailing comma", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name@file.ts:10,",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with leading comma", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: ",function:name@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("name (function)");
  });

  it("handles symbols with only comma", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: ",",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with empty string", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 0,
      symbols: "",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with whitespace only", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "   ",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with newline only", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "\n",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with tab only", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "\t",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with mixed whitespace", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: " \t\n ",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with unicode whitespace", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "\u00A0",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with zero-width space", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "\u200B",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with right-to-left mark", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "\u200F",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with byte order mark", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "\uFEFF",
    };
    expect(buildSymbolText(entry)).toBe("");
  });

  it("handles symbols with combining characters", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:name\u0301@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("namé (function)");
  });

  it("handles symbols with surrogate pairs", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:\uD83D\uDE80@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe("🚀 (function)");
  });

  it("handles symbols with invalid surrogate pair", () => {
    const entry = {
      path: "src/main.ts",
      lang: "typescript",
      symbolsCount: 1,
      symbols: "function:\uD800@file.ts:10",
    };
    expect(buildSymbolText(entry)).toBe(" (function)");
  });
});
