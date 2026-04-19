import { describe, it, expect } from "vitest";
import {
  getContextValue,
  getInputField,
  matchValuePattern,
  isGroupActive,
  substituteVariables,
  doesRuleMatch,
} from "./pattern-matching";

describe("getContextValue", () => {
  describe("given tool_name context", () => {
    it("then returns the tool name", () => {
      const result = getContextValue("tool_name", "write", {});
      expect(result).toBe("write");
    });

    it("then returns undefined when toolName is undefined", () => {
      const result = getContextValue("tool_name", undefined, {});
      expect(result).toBeUndefined();
    });
  });

  describe("given file_name context", () => {
    it("then returns the path from input", () => {
      const result = getContextValue("file_name", "write", { path: "test.ts" });
      expect(result).toBe("test.ts");
    });

    it("then returns undefined when path is not in input", () => {
      const result = getContextValue("file_name", "write", { content: "test" });
      expect(result).toBeUndefined();
    });

    it("then returns undefined when input is undefined", () => {
      const result = getContextValue("file_name", "write", undefined);
      expect(result).toBeUndefined();
    });
  });

  describe("given command context", () => {
    it("then returns command when tool is bash", () => {
      const result = getContextValue("command", "bash", { command: "ls -la" });
      expect(result).toBe("ls -la");
    });

    it("then returns undefined when tool is not bash", () => {
      const result = getContextValue("command", "write", {
        command: "npm install",
      });
      expect(result).toBeUndefined();
    });

    it("then returns undefined when command is not in input", () => {
      const result = getContextValue("command", "bash", { path: "/tmp" });
      expect(result).toBeUndefined();
    });
  });
});

describe("getInputField", () => {
  describe("given valid input object", () => {
    it("then returns the field value", () => {
      const result = getInputField(
        { path: "test.ts", content: "test" },
        "path",
      );
      expect(result).toBe("test.ts");
    });

    it("then converts non-string values to string", () => {
      const result = getInputField({ count: 42 }, "count");
      expect(result).toBe("42");
    });
  });

  describe("given missing field", () => {
    it("then returns undefined", () => {
      const result = getInputField({ path: "test.ts" }, "content");
      expect(result).toBeUndefined();
    });
  });

  describe("given null or undefined input", () => {
    it("then returns undefined for null", () => {
      const result = getInputField(null, "path");
      expect(result).toBeUndefined();
    });

    it("then returns undefined for undefined", () => {
      const result = getInputField(undefined, "path");
      expect(result).toBeUndefined();
    });
  });

  describe("given non-object input", () => {
    it("then returns undefined for string", () => {
      const result = getInputField("not an object", "path");
      expect(result).toBeUndefined();
    });

    it("then returns undefined for number", () => {
      const result = getInputField(123, "path");
      expect(result).toBeUndefined();
    });
  });
});

describe("matchValuePattern", () => {
  describe("given glob pattern for file extensions", () => {
    it("then matches *.ts for TypeScript files", () => {
      expect(matchValuePattern("file_name", "test.ts", "*.ts")).toBe(true);
      expect(matchValuePattern("file_name", "src/index.ts", "*.ts")).toBe(true);
    });

    it("then matches *.{ts,tsx} for TypeScript and TSX", () => {
      expect(matchValuePattern("file_name", "test.ts", "*.{ts,tsx}")).toBe(
        true,
      );
      expect(matchValuePattern("file_name", "test.tsx", "*.{ts,tsx}")).toBe(
        true,
      );
      expect(matchValuePattern("file_name", "test.js", "*.{ts,tsx}")).toBe(
        false,
      );
    });

    it("then matches basename for paths", () => {
      expect(matchValuePattern("file_name", "/home/user/test.ts", "*.ts")).toBe(
        true,
      );
      expect(matchValuePattern("file_name", "src/utils.ts", "*.ts")).toBe(true);
    });
  });

  describe("given alternation pattern", () => {
    it("then matches any alternative", () => {
      expect(matchValuePattern("tool_name", "write", "{write,edit}")).toBe(
        true,
      );
      expect(matchValuePattern("tool_name", "edit", "{write,edit}")).toBe(true);
      expect(matchValuePattern("tool_name", "read", "{write,edit}")).toBe(
        false,
      );
    });
  });

  describe("given exact string pattern", () => {
    it("then matches exact tool names", () => {
      expect(matchValuePattern("tool_name", "write", "write")).toBe(true);
      expect(matchValuePattern("tool_name", "edit", "write")).toBe(false);
    });
  });

  describe("given wildcard pattern", () => {
    it("then matches any file", () => {
      expect(matchValuePattern("file_name", "test.js", "*")).toBe(true);
      expect(matchValuePattern("file_name", "test.ts", "*")).toBe(true);
    });
  });

  describe("given invalid pattern", () => {
    it("then returns false gracefully", () => {
      expect(matchValuePattern("file_name", "test", "[invalid")).toBe(false);
    });
  });
});

describe("isGroupActive", () => {
  const testDir = import.meta.dirname;

  describe("given wildcard pattern", () => {
    it("then returns true regardless of directory contents", async () => {
      expect(await isGroupActive("*", testDir)).toBe(true);
      expect(await isGroupActive("*", "/nonexistent")).toBe(true);
    });
  });

  describe("given specific file pattern", () => {
    it("then returns true when file exists in directory", async () => {
      expect(await isGroupActive("package.json", testDir)).toBe(true);
    });

    it("then returns false when file does not exist", async () => {
      expect(await isGroupActive("nonexistent-file-xyz.json", testDir)).toBe(
        false,
      );
    });
  });

  describe("given glob pattern", () => {
    it("then returns true when matching files exist", async () => {
      expect(await isGroupActive("*.ts", testDir)).toBe(true);
      expect(await isGroupActive("*.json", testDir)).toBe(true);
    });

    it("then returns false when no matching files exist", async () => {
      expect(await isGroupActive("*.xyz", testDir)).toBe(false);
      expect(await isGroupActive("*.nonexistent", testDir)).toBe(false);
    });
  });

  describe("given invalid pattern", () => {
    it("then returns false gracefully", async () => {
      expect(await isGroupActive("[invalid", testDir)).toBe(false);
    });
  });
});

describe("substituteVariables", () => {
  describe("given command with %file% variable", () => {
    it("then substitutes the file path when file is provided", () => {
      const result = substituteVariables('biome format "%file%"', {
        file: "src/index.ts",
        cwd: "/home/user/project",
      });
      expect(result).toBe('biome format "src/index.ts"');
    });

    it("then replaces with empty string when file is undefined", () => {
      const result = substituteVariables("command %file%", {
        cwd: "/home/user",
      });
      expect(result).toBe("command ");
    });
  });

  describe("given command with %tool% variable", () => {
    it("then substitutes the tool name when tool is provided", () => {
      const result = substituteVariables("echo %tool%", {
        tool: "write",
        cwd: "/home/user/project",
      });
      expect(result).toBe("echo write");
    });

    it("then replaces with empty string when tool is undefined", () => {
      const result = substituteVariables("echo %tool%", {
        cwd: "/home/user",
      });
      expect(result).toBe("echo ");
    });
  });

  describe("given command with %cwd% variable", () => {
    it("then substitutes the working directory", () => {
      const result = substituteVariables("cd %cwd% && ls", {
        cwd: "/home/user/project",
      });
      expect(result).toBe("cd /home/user/project && ls");
    });
  });

  describe("given command with multiple variables", () => {
    it("then substitutes all variables", () => {
      const result = substituteVariables('echo "%tool%: %file%" in %cwd%', {
        file: "test.ts",
        tool: "edit",
        cwd: "/tmp",
      });
      expect(result).toBe('echo "edit: test.ts" in /tmp');
    });

    it("then substitutes all occurrences of the same variable", () => {
      const result = substituteVariables("%file% and %file%", {
        file: "test.ts",
        cwd: "/tmp",
      });
      expect(result).toBe("test.ts and test.ts");
    });
  });

  describe("given command with special characters in values", () => {
    it("then preserves spaces in output", () => {
      const result = substituteVariables('cmd "%file%"', {
        file: "path/with spaces/file.ts",
        cwd: "/tmp",
      });
      expect(result).toBe('cmd "path/with spaces/file.ts"');
    });

    it("then preserves special characters", () => {
      const result = substituteVariables("cd %cwd%", {
        cwd: "/home/user/my-project_v2",
      });
      expect(result).toBe("cd /home/user/my-project_v2");
    });
  });
});

// eslint-disable-next-line max-lines-per-function -- large test suite
describe("doesRuleMatch", () => {
  describe("given rule without context", () => {
    const rule = { event: "tool_result" as const, command: "echo test" };

    it("then always matches regardless of tool", () => {
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
      expect(doesRuleMatch(rule, "edit", {})).toBe(true);
      expect(doesRuleMatch(rule, "bash", {})).toBe(true);
    });

    it("then still matches when tool name is undefined", () => {
      expect(doesRuleMatch(rule, undefined, {})).toBe(true);
    });
  });

  describe("given rule with context but no pattern", () => {
    const rule = {
      event: "tool_result" as const,
      command: "echo test",
      context: "tool_name" as const,
    };

    it("then always matches", () => {
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
    });
  });

  describe("given rule with tool_name context", () => {
    it("then matches exact tool name", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "write",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
      expect(doesRuleMatch(rule, "edit", {})).toBe(false);
      expect(doesRuleMatch(rule, "write-file", {})).toBe(false);
    });

    it("then matches any of the alternatives in alternation pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "{write,edit}",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
      expect(doesRuleMatch(rule, "edit", {})).toBe(true);
      expect(doesRuleMatch(rule, "read", {})).toBe(false);
      expect(doesRuleMatch(rule, "bash", {})).toBe(false);
    });

    it("then does not match when tool name is undefined", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "write",
      };
      expect(doesRuleMatch(rule, undefined, {})).toBe(false);
    });
  });

  describe("given rule with file_name context", () => {
    it("then matches TypeScript files against *.{ts,tsx} pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "prettier %file%",
        context: "file_name" as const,
        pattern: "*.{ts,tsx}",
      };
      expect(doesRuleMatch(rule, "write", { path: "src/index.ts" })).toBe(true);
      expect(doesRuleMatch(rule, "write", { path: "src/App.tsx" })).toBe(true);
      expect(doesRuleMatch(rule, "write", { path: "src/index.js" })).toBe(
        false,
      );
      expect(doesRuleMatch(rule, "write", { path: "src/style.css" })).toBe(
        false,
      );
    });

    it("then matches test files against *.test.ts pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "vitest run %file%",
        context: "file_name" as const,
        pattern: "*.test.ts",
      };
      expect(doesRuleMatch(rule, "write", { path: "src/utils.test.ts" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "write", { path: "src/utils.ts" })).toBe(
        false,
      );
      expect(doesRuleMatch(rule, "write", { path: "src/test.ts" })).toBe(false);
    });

    it("then does not match when path is not in input", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "file_name" as const,
        pattern: "*.ts",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(false);
      expect(doesRuleMatch(rule, "write", { other: "value" })).toBe(false);
    });

    it("then does not match when input is null or undefined", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "file_name" as const,
        pattern: "*.ts",
      };
      expect(doesRuleMatch(rule, "write", null)).toBe(false);
      expect(doesRuleMatch(rule, "write", undefined)).toBe(false);
    });
  });

  describe("given rule with command context", () => {
    it("then matches npm commands against npm * pattern", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo 'running npm'",
        context: "command" as const,
        pattern: "npm *",
      };
      expect(doesRuleMatch(rule, "bash", { command: "npm install" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "bash", { command: "npm run build" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "bash", { command: "yarn install" })).toBe(
        false,
      );
      expect(doesRuleMatch(rule, "bash", { command: "pnpm install" })).toBe(
        false,
      );
    });

    it("then matches dangerous rm -rf commands", () => {
      const rule = {
        event: "tool_call" as const,
        command: "exit 2",
        context: "command" as const,
        pattern: "rm -rf /*",
      };
      expect(doesRuleMatch(rule, "bash", { command: "rm -rf /" })).toBe(true);
      expect(doesRuleMatch(rule, "bash", { command: "rm -rf /etc" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "bash", { command: "rm -rf ./temp" })).toBe(
        false,
      );
      expect(doesRuleMatch(rule, "bash", { command: "rm file.txt" })).toBe(
        false,
      );
    });

    it("then does not match when tool is not bash", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo test",
        context: "command" as const,
        pattern: "npm",
      };
      expect(doesRuleMatch(rule, "write", { command: "npm install" })).toBe(
        false,
      );
      expect(doesRuleMatch(rule, "edit", { command: "npm install" })).toBe(
        false,
      );
    });

    it("then does not match when command is not in input", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo test",
        context: "command" as const,
        pattern: "npm",
      };
      expect(doesRuleMatch(rule, "bash", {})).toBe(false);
      expect(doesRuleMatch(rule, "bash", { path: "/tmp" })).toBe(false);
    });
  });

  describe("given command context with AST-like patterns", () => {
    it("then matches package manager dev commands with ? placeholder", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo blocked",
        context: "command" as const,
        pattern: "? run dev *",
      };
      expect(doesRuleMatch(rule, "bash", { command: "bun run dev" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "bash", { command: "npm run dev" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "bash", { command: "bun run build" })).toBe(
        false,
      );
    });

    it("then still matches normalized command behind env vars", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo blocked",
        context: "command" as const,
        pattern: "npm *",
      };
      expect(
        doesRuleMatch(rule, "bash", {
          command: "NODE_ENV=prod env npm start",
        }),
      ).toBe(true);
    });

    it("then matches any segment after &&", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo blocked",
        context: "command" as const,
        pattern: "npm *",
      };
      expect(
        doesRuleMatch(rule, "bash", {
          command: "cd /project && npm install",
        }),
      ).toBe(true);
    });
  });

  describe("given rule with invalid glob pattern", () => {
    it("then returns false gracefully", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "[invalid",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(false);
    });
  });

  describe("given rule with case-sensitive pattern", () => {
    it("then does not match when case differs", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "Write",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(false);
      expect(doesRuleMatch(rule, "Write", {})).toBe(true);
    });
  });
});
