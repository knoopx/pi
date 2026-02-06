import { describe, it, expect } from "vitest";
import { isGroupActive, substituteVariables, doesRuleMatch } from "./index";

describe("isGroupActive", () => {
  const testDir = import.meta.dirname;

  it("returns true for wildcard pattern", async () => {
    expect(await isGroupActive("*", testDir)).toBe(true);
  });

  it("returns true when matching files exist", async () => {
    expect(await isGroupActive("package.json", testDir)).toBe(true);
  });

  it("returns false when no matching files exist", async () => {
    expect(await isGroupActive("nonexistent-file-xyz.json", testDir)).toBe(
      false,
    );
  });

  it("returns true for glob patterns that match", async () => {
    expect(await isGroupActive("*.ts", testDir)).toBe(true);
  });

  it("returns false for glob patterns that dont match", async () => {
    expect(await isGroupActive("*.xyz", testDir)).toBe(false);
  });

  it("handles invalid patterns gracefully", async () => {
    expect(await isGroupActive("[invalid", testDir)).toBe(false);
  });
});

describe("substituteVariables", () => {
  it("substitutes ${file} variable", () => {
    const result = substituteVariables('biome format "${file}"', {
      file: "src/index.ts",
      cwd: "/home/user/project",
    });
    expect(result).toBe('biome format "src/index.ts"');
  });

  it("substitutes ${tool} variable", () => {
    const result = substituteVariables("echo ${tool}", {
      tool: "write",
      cwd: "/home/user/project",
    });
    expect(result).toBe("echo write");
  });

  it("substitutes ${cwd} variable", () => {
    const result = substituteVariables("cd ${cwd} && ls", {
      cwd: "/home/user/project",
    });
    expect(result).toBe("cd /home/user/project && ls");
  });

  it("substitutes multiple variables", () => {
    const result = substituteVariables('echo "${tool}: ${file}" in ${cwd}', {
      file: "test.ts",
      tool: "edit",
      cwd: "/tmp",
    });
    expect(result).toBe('echo "edit: test.ts" in /tmp');
  });

  it("replaces undefined variables with empty string", () => {
    const result = substituteVariables("command ${file}", {
      cwd: "/home/user",
    });
    expect(result).toBe("command ");
  });

  it("handles multiple occurrences of same variable", () => {
    const result = substituteVariables("${file} and ${file}", {
      file: "test.ts",
      cwd: "/tmp",
    });
    expect(result).toBe("test.ts and test.ts");
  });
});

describe("doesRuleMatch", () => {
  describe("without context", () => {
    it("matches when no context is specified", () => {
      const rule = { event: "tool_result" as const, command: "echo test" };
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
    });

    it("matches when context is specified but pattern is not", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
    });
  });

  describe("tool_name context", () => {
    it("matches tool name with exact pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "^write$",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
      expect(doesRuleMatch(rule, "edit", {})).toBe(false);
    });

    it("matches tool name with partial pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "write|edit",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(true);
      expect(doesRuleMatch(rule, "edit", {})).toBe(true);
      expect(doesRuleMatch(rule, "read", {})).toBe(false);
    });

    it("returns false when tool name is undefined", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "write",
      };
      expect(doesRuleMatch(rule, undefined, {})).toBe(false);
    });
  });

  describe("file_name context", () => {
    it("matches file extension pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "prettier ${file}",
        context: "file_name" as const,
        pattern: "\\.(ts|tsx)$",
      };
      expect(doesRuleMatch(rule, "write", { path: "src/index.ts" })).toBe(true);
      expect(doesRuleMatch(rule, "write", { path: "src/App.tsx" })).toBe(true);
      expect(doesRuleMatch(rule, "write", { path: "src/index.js" })).toBe(
        false,
      );
    });

    it("matches file path pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "vitest run ${file}",
        context: "file_name" as const,
        pattern: "\\.test\\.ts$",
      };
      expect(doesRuleMatch(rule, "write", { path: "src/utils.test.ts" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "write", { path: "src/utils.ts" })).toBe(
        false,
      );
    });

    it("returns false when path is not in input", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "file_name" as const,
        pattern: "\\.ts$",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(false);
      expect(doesRuleMatch(rule, "write", { other: "value" })).toBe(false);
    });

    it("returns false when input is null or undefined", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "file_name" as const,
        pattern: "\\.ts$",
      };
      expect(doesRuleMatch(rule, "write", null)).toBe(false);
      expect(doesRuleMatch(rule, "write", undefined)).toBe(false);
    });
  });

  describe("command context", () => {
    it("matches bash command pattern", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo 'running npm'",
        context: "command" as const,
        pattern: "^npm ",
      };
      expect(doesRuleMatch(rule, "bash", { command: "npm install" })).toBe(
        true,
      );
      expect(doesRuleMatch(rule, "bash", { command: "yarn install" })).toBe(
        false,
      );
    });

    it("returns false for non-bash tools", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo test",
        context: "command" as const,
        pattern: "npm",
      };
      expect(doesRuleMatch(rule, "write", { command: "npm install" })).toBe(
        false,
      );
    });

    it("returns false when command is not in input", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo test",
        context: "command" as const,
        pattern: "npm",
      };
      expect(doesRuleMatch(rule, "bash", {})).toBe(false);
    });
  });

  describe("invalid patterns", () => {
    it("returns false for invalid regex pattern", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "[invalid",
      };
      expect(doesRuleMatch(rule, "write", {})).toBe(false);
    });
  });
});
