import { describe, it, expect } from "vitest";
import { createRun } from "../../shared/testing/spawn-helper";

const runNu = createRun("nu", (c) => ["-c", c]);
const runDuckdb = createRun("duckdb", (q) => [":memory:", "-no-init", "-c", q]);
const runBun = createRun("bun", (c) => ["-e", c]);
const runPython = createRun("python3", (c) => ["-c", c]);

// Shared helper for "run command → assert exit 0 + exact stdout" tests.
async function assertOutput(
  run: (cmd: string) => Promise<{ exitCode: number | null; stdout: string }>,
  label: string,
  cmd: string,
  expected: string,
) {
  describe(`given ${label}`, () => {
    it("then output matches expected", async () => {
      const result = await run(cmd);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(expected);
    });
  });
}

// Shared helper for escape sequence interpretation tests.
function assertEscapeInterpret(
  run: (cmd: string) => Promise<{ exitCode: number | null; stdout: string }>,
  runtime: string,
  cmd: string,
) {
  describe(`given a string with escape sequences`, () => {
    it(`then ${runtime} interprets escape sequences`, async () => {
      const result = await run(cmd);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("line1\n");
      expect(result.stdout).toContain("line2");
    });
  });
}

function extractDuckdbValue(stdout: string): string {
  const lines = stdout.split("\n");
  const dataIdx = lines.findIndex((l) => l.includes("├"));
  if (dataIdx >= 0 && dataIdx + 1 < lines.length) {
    const dataLine = lines[dataIdx + 1];
    const first = dataLine.indexOf("│");
    const last = dataLine.lastIndexOf("│");
    if (first >= 0 && last > first) {
      return dataLine.slice(first + 1, last).trim();
    }
  }
  return stdout.trim();
}

describe("nu-repl input quoting", () => {
  describe("given a command with single-quoted string", () => {
    it("then nushell outputs the literal content without escapes", async () => {
      const result = await runNu("echo 'hello world'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("hello world");
    });
  });

  describe("given a command with double-quoted string containing a single quote", () => {
    it("then nushell renders the apostrophe correctly", async () => {
      const result = await runNu('echo "it\'s"');
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("it's");
    });
  });

  assertEscapeInterpret(runNu, "nushell", 'echo "line1\\nline2"');

  describe("given a command with \\n in single quotes", () => {
    it("then nushell treats backslash-n as literal characters", async () => {
      const result = await runNu("echo 'line1\\nline2'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("line1\\nline2");
    });
  });

  assertOutput(
    runNu,
    "a command with unicode in single quotes",
    "echo 'café'",
    "café",
  );

  assertOutput(
    runNu,
    "a command with backslashes in single quotes",
    "echo 'path\\to\\file'",
    "path\\to\\file",
  );

  assertOutput(
    runNu,
    "a command with backslashes in double quotes",
    'echo "tab\\there"',
    "tab\there",
  );

  assertOutput(
    runNu,
    "a command with dollar sign in single quotes",
    "echo '$VAR'",
    "$VAR",
  );

  assertOutput(
    runNu,
    "a command with variable in parentheses",
    'let x = "hello"; echo ($x)',
    "hello",
  );

  assertOutput(
    runNu,
    "a command with empty single-quoted string",
    "echo ''",
    "",
  );

  describe("given a command with embedded newline via \\n in double quotes", () => {
    it("then nushell outputs two lines", async () => {
      const result = await runNu('echo "a\\nb"');
      expect(result.exitCode).toBe(0);
      const lines = result.stdout.trim().split("\n");
      expect(lines).toEqual(["a", "b"]);
    });
  });

  describe("given a command with mixed quote styles concatenated", () => {
    it("then nushell handles both single and double quoted segments", async () => {
      const result = await runNu(`'single' + "double"`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("singledouble");
    });
  });

  describe("given a command with a string containing parentheses", () => {
    it("then nushell does not treat them as subshells", async () => {
      const result = await runNu("echo '(not a subshell)'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("(not a subshell)");
    });
  });

  describe("given a command with a string containing semicolons", () => {
    it("then nushell does not split on semicolons inside quotes", async () => {
      const result = await runNu("echo 'a;b;c'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("a;b;c");
    });
  });

  describe("given a command with a string containing pipe characters", () => {
    it("then nushell does not create a pipeline inside quotes", async () => {
      const result = await runNu("echo 'a|b|c'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("a|b|c");
    });
  });

  describe("given a command with a string containing angle brackets", () => {
    it("then nushell does not redirect inside quotes", async () => {
      const result = await runNu("echo 'a < b > c'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("a < b > c");
    });
  });

  describe("given a command with a string containing ampersand", () => {
    it("then nushell does not background the process inside quotes", async () => {
      const result = await runNu("echo 'a & b'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("a & b");
    });
  });

  describe("given a command with a string containing backticks", () => {
    it("then nushell does not interpolate command substitution", async () => {
      const result = await runNu("echo 'hello `world`'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("hello `world`");
    });
  });

  describe("given a command with a string containing dollar-sign-parens", () => {
    it("then nushell does not expand command substitution in single quotes", async () => {
      const result = await runNu("echo '$(hostname)'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("$(hostname)");
    });
  });

  describe("given a command with percent signs", () => {
    it("then nushell preserves percent literally", async () => {
      const result = await runNu("echo '100%'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("100%");
    });
  });

  describe("given a command with hash characters", () => {
    it("then nushell does not strip as comment inside quotes", async () => {
      const result = await runNu("echo '#hashtag'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("#hashtag");
    });
  });

  describe("given a command with equals signs", () => {
    it("then nushell preserves equals signs inside quotes", async () => {
      const result = await runNu("echo 'a=b'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("a=b");
    });
  });

  describe("given a malformed command with unclosed quote", () => {
    it("then nushell returns a parser error", async () => {
      const result = await runNu("echo 'unclosed");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unexpected end of code");
    });
  });

  describe("given a command with file path containing spaces", () => {
    it("then nushell preserves the path with spaces", async () => {
      const result = await runNu("echo '/path/to/my file.txt'");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/path/to/my file.txt");
    });
  });
});

describe("duckdb-repl input quoting", () => {
  describe("given a query with single-quoted string literal", () => {
    it("then duckdb outputs the literal content", async () => {
      const result = await runDuckdb("SELECT 'hello world'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("hello world");
    });
  });

  describe("given a query with escaped single quote (doubled)", () => {
    it("then duckdb renders the apostrophe correctly", async () => {
      const result = await runDuckdb("SELECT 'it''s'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("it's");
    });
  });

  describe("given a query with double-quoted identifier", () => {
    it("then duckdb treats it as a column name, not a string", async () => {
      const result = await runDuckdb('SELECT "hello"');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("was not found");
    });
  });

  describe("given a query with double-quoted identifier from a table", () => {
    it("then duckdb resolves the quoted column name", async () => {
      const result = await runDuckdb('SELECT "col" FROM (SELECT 1 AS "col")');
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("1");
    });
  });

  describe("given a query with unicode in single quotes", () => {
    it("then duckdb preserves the unicode characters", async () => {
      const result = await runDuckdb("SELECT 'café'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("café");
    });
  });

  describe("given a query with backslashes in single quotes", () => {
    it("then duckdb preserves the backslashes literally", async () => {
      const result = await runDuckdb("SELECT 'path\\to\\file'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("path\\to\\file");
    });
  });

  describe("given a query with \\n in single quotes", () => {
    it("then duckdb preserves the backslash-n literally", async () => {
      const result = await runDuckdb("SELECT 'line1\\nline2'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("line1\\nline2");
    });
  });

  describe("given a query with empty string", () => {
    it("then duckdb outputs an empty value", async () => {
      const result = await runDuckdb("SELECT ''");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("");
    });
  });

  describe("given a query with dollar-quoted string containing single quotes", () => {
    it("then duckdb renders the embedded apostrophe correctly", async () => {
      const result = await runDuckdb("SELECT \$\$it's\$\$");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("it's");
    });
  });

  describe("given a query with dollar-quoted string with tag", () => {
    it("then duckdb uses the tagged delimiter", async () => {
      const result = await runDuckdb("SELECT \$q\$has 'quotes' inside\$q\$");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("has 'quotes' inside");
    });
  });

  describe("given a query with semicolons inside quoted string", () => {
    it("then duckdb does not split the statement on semicolons", async () => {
      const result = await runDuckdb("SELECT 'a;b;c'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("a;b;c");
    });
  });

  describe("given a query with pipe characters inside quoted string", () => {
    it("then duckdb preserves pipes literally", async () => {
      const result = await runDuckdb("SELECT 'a|b|c'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("a|b|c");
    });
  });

  describe("given a query with angle brackets inside quoted string", () => {
    it("then duckdb preserves them literally", async () => {
      const result = await runDuckdb("SELECT 'a < b > c'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("a < b > c");
    });
  });

  describe("given a query with ampersand inside quoted string", () => {
    it("then duckdb preserves it literally", async () => {
      const result = await runDuckdb("SELECT 'a & b'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("a & b");
    });
  });

  describe("given a query with asterisk inside quoted string", () => {
    it("then duckdb preserves it literally", async () => {
      const result = await runDuckdb("SELECT 'a*b*c'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("a*b*c");
    });
  });

  describe("given a query with dollar sign inside quoted string", () => {
    it("then duckdb preserves it literally", async () => {
      const result = await runDuckdb("SELECT '$100'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("$100");
    });
  });

  describe("given a query with parentheses inside quoted string", () => {
    it("then duckdb preserves them literally", async () => {
      const result = await runDuckdb("SELECT '(not a subquery)'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("(not a subquery)");
    });
  });

  describe("given a query with backticks inside quoted string", () => {
    it("then duckdb preserves them literally", async () => {
      const result = await runDuckdb("SELECT 'hello `world`'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("hello `world`");
    });
  });

  describe("given a query with percent signs", () => {
    it("then duckdb preserves percent literally", async () => {
      const result = await runDuckdb("SELECT '100%'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("100%");
    });
  });

  describe("given a query with hash characters", () => {
    it("then duckdb does not strip as comment inside quotes", async () => {
      const result = await runDuckdb("SELECT '#hashtag'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("#hashtag");
    });
  });

  describe("given a query with equals signs", () => {
    it("then duckdb preserves equals signs inside quotes", async () => {
      const result = await runDuckdb("SELECT 'a=b'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("a=b");
    });
  });

  describe("given a query with curly braces", () => {
    it("then duckdb preserves curly braces inside quotes", async () => {
      const result = await runDuckdb("SELECT '{ a: 1 }'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("{ a: 1 }");
    });
  });

  describe("given a multi-line query", () => {
    it("then duckdb executes the full statement across lines", async () => {
      const result = await runDuckdb(
        "SELECT a, b\nFROM (SELECT 1 AS a, 2 AS b)",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1");
      expect(result.stdout).toContain("2");
    });
  });

  describe("given a query with json_extract and nested quotes", () => {
    it("then duckdb parses the json path correctly", async () => {
      const result = await runDuckdb(
        "SELECT json_extract('{\"key\": \"val\"}', '$.key')",
      );
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe('"val"');
    });
  });

  describe("given a query reading a file path with spaces in the string", () => {
    it("then duckdb preserves the path with spaces", async () => {
      const result = await runDuckdb("SELECT '/path/to/my file.csv' AS path");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("/path/to/my file.csv");
    });
  });

  describe("given a query with string_agg and concatenation delimiter", () => {
    it("then duckdb uses the delimiter with spaces correctly", async () => {
      const result = await runDuckdb(
        "SELECT string_agg(v, ', ') FROM (VALUES ('a'), ('b')) t(v)",
      );
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("a, b");
    });
  });

  describe("given a malformed query with unclosed single quote", () => {
    it("then duckdb returns a parser error", async () => {
      const result = await runDuckdb("SELECT 'unclosed");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("unterminated");
    });
  });

  describe("given a query with multiple escaped quotes", () => {
    it("then duckdb renders all apostrophes correctly", async () => {
      const result = await runDuckdb("SELECT 'don''t can''t won''t'");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("don't can't won't");
    });
  });

  describe("given spawn is called with shell: false", () => {
    it("then no shell interprets the arguments", async () => {
      const result = await runDuckdb("SELECT '$(hostname); rm -rf /' AS safe");
      expect(result.exitCode).toBe(0);
      expect(extractDuckdbValue(result.stdout)).toBe("$(hostname); rm -rf /");
    });
  });
});

describe("bun-repl input quoting", () => {
  assertOutput(runBun, "a simple expression", "console.log(2 + 2)", "4");

  assertOutput(
    runBun,
    "a string with single quotes",
    "console.log('hello world')",
    "hello world",
  );

  assertOutput(
    runBun,
    "a string with double quotes",
    'console.log("hello world")',
    "hello world",
  );

  describe("given a string with template literals", () => {
    it("then bun interpolates the expression", async () => {
      const result = await runBun("console.log(`hello ${2 + 2}`)");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("hello 4");
    });
  });

  assertOutput(runBun, "a string with unicode", "console.log('café')", "café");

  assertEscapeInterpret(runBun, "bun", 'console.log("line1\\nline2")');

  describe("given an async expression with await", () => {
    it("then bun supports top-level await", async () => {
      const result = await runBun("console.log(await Promise.resolve(42))");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("42");
    });
  });

  describe("given a TypeScript expression", () => {
    it("then bun compiles and runs the TypeScript", async () => {
      const result = await runBun("const x: number = 42; console.log(x)");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("42");
    });
  });

  describe("given a malformed expression with unclosed quote", () => {
    it("then bun returns a parse error", async () => {
      const result = await runBun("console.log('unclosed");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unterminated");
    });
  });

  assertOutput(
    runBun,
    "a string with semicolons",
    "console.log('a;b;c')",
    "a;b;c",
  );

  assertOutput(
    runBun,
    "a string with pipe characters",
    "console.log('a|b|c')",
    "a|b|c",
  );

  assertOutput(
    runBun,
    "a string with angle brackets",
    "console.log('a < b > c')",
    "a < b > c",
  );

  assertOutput(
    runBun,
    "a string with dollar-sign-parens",
    "console.log('$(hostname)')",
    "$(hostname)",
  );

  assertOutput(
    runBun,
    "a string with percent signs",
    "console.log('100%')",
    "100%",
  );

  assertOutput(
    runBun,
    "a string with hash characters",
    "console.log('#hashtag')",
    "#hashtag",
  );

  assertOutput(
    runBun,
    "a string with ampersand",
    "console.log('a & b')",
    "a & b",
  );

  assertOutput(
    runBun,
    "a string with backticks inside single quotes",
    "console.log('hello `world`')",
    "hello `world`",
  );

  assertOutput(
    runBun,
    "a string with file path containing spaces",
    "console.log('/path/to/my file.txt')",
    "/path/to/my file.txt",
  );

  describe("given spawn is called with shell: false", () => {
    it("then no shell interprets the arguments", async () => {
      const result = await runBun("console.log('$(hostname); rm -rf /')");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("$(hostname); rm -rf /");
    });
  });
});

describe("python-repl input quoting", () => {
  assertOutput(runPython, "a simple expression", "print(2 + 2)", "4");

  assertOutput(
    runPython,
    "a string with single quotes",
    "print('hello world')",
    "hello world",
  );

  assertOutput(
    runPython,
    "a string with double quotes",
    'print("hello world")',
    "hello world",
  );

  assertOutput(runPython, "a string with unicode", "print('café')", "café");

  assertEscapeInterpret(runPython, "python", 'print("line1\\nline2")');

  describe("given a raw string with backslashes", () => {
    it("then python preserves the backslashes literally", async () => {
      const result = await runPython("print(r'path\\to\\file')");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("path\\to\\file");
    });
  });

  describe("given a f-string with expression", () => {
    it("then python interpolates the expression", async () => {
      const result = await runPython("print(f'value is {2 + 2}')");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("value is 4");
    });
  });

  assertOutput(
    runPython,
    "a string with semicolons",
    "print('a;b;c')",
    "a;b;c",
  );

  assertOutput(
    runPython,
    "a string with pipe characters",
    "print('a|b|c')",
    "a|b|c",
  );

  assertOutput(
    runPython,
    "a string with angle brackets",
    "print('a < b > c')",
    "a < b > c",
  );

  assertOutput(
    runPython,
    "a string with dollar-sign-parens",
    "print('$(hostname)')",
    "$(hostname)",
  );

  assertOutput(
    runPython,
    "a string with percent signs",
    "print('100%')",
    "100%",
  );

  assertOutput(
    runPython,
    "a string with hash characters",
    "print('#hashtag')",
    "#hashtag",
  );

  assertOutput(runPython, "a string with ampersand", "print('a & b')", "a & b");

  assertOutput(
    runPython,
    "a string with backticks",
    "print('hello `world`')",
    "hello `world`",
  );

  assertOutput(
    runPython,
    "a string with file path containing spaces",
    "print('/path/to/my file.txt')",
    "/path/to/my file.txt",
  );

  describe("given a malformed expression with unclosed quote", () => {
    it("then python returns a syntax error", async () => {
      const result = await runPython("print('unclosed");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("SyntaxError");
    });
  });

  describe("given spawn is called with shell: false", () => {
    it("then no shell interprets the arguments", async () => {
      const result = await runPython("print('$(hostname); rm -rf /')");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("$(hostname); rm -rf /");
    });
  });
});
