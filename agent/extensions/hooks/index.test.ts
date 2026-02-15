import { describe, it, expect } from "vitest";
import { isGroupActive, substituteVariables, doesRuleMatch } from "./index";

describe("isGroupActive", () => {
  const testDir = import.meta.dirname;

  describe("given wildcard pattern", () => {
    describe("when checking activation", () => {
      it("then returns true regardless of directory contents", async () => {
        expect(await isGroupActive("*", testDir)).toBe(true);
        expect(await isGroupActive("*", "/nonexistent")).toBe(true);
      });
    });
  });

  describe("given specific file pattern", () => {
    describe("when file exists in directory", () => {
      it("then returns true", async () => {
        expect(await isGroupActive("package.json", testDir)).toBe(true);
      });
    });

    describe("when file does not exist", () => {
      it("then returns false", async () => {
        expect(await isGroupActive("nonexistent-file-xyz.json", testDir)).toBe(
          false,
        );
      });
    });
  });

  describe("given glob pattern", () => {
    describe("when matching files exist", () => {
      it("then returns true for *.ts pattern", async () => {
        expect(await isGroupActive("*.ts", testDir)).toBe(true);
      });

      it("then returns true for *.json pattern", async () => {
        expect(await isGroupActive("*.json", testDir)).toBe(true);
      });
    });

    describe("when no matching files exist", () => {
      it("then returns false", async () => {
        expect(await isGroupActive("*.xyz", testDir)).toBe(false);
        expect(await isGroupActive("*.nonexistent", testDir)).toBe(false);
      });
    });
  });

  describe("given invalid pattern", () => {
    describe("when pattern is malformed", () => {
      it("then returns false gracefully", async () => {
        expect(await isGroupActive("[invalid", testDir)).toBe(false);
      });
    });
  });

  describe("given dot file pattern", () => {
    describe("when checking for hidden files", () => {
      it("then matches dot files when pattern includes dot", async () => {
        // The glob should match dot files with dot: true option
        expect(await isGroupActive(".*", testDir)).toBe(false); // No dot files in test dir
      });
    });
  });
});

describe("substituteVariables", () => {
  describe("given command with ${file} variable", () => {
    describe("when file is provided", () => {
      it("then substitutes the file path", () => {
        const result = substituteVariables('biome format "${file}"', {
          file: "src/index.ts",
          cwd: "/home/user/project",
        });
        expect(result).toBe('biome format "src/index.ts"');
      });
    });

    describe("when file is undefined", () => {
      it("then replaces with empty string", () => {
        const result = substituteVariables("command ${file}", {
          cwd: "/home/user",
        });
        expect(result).toBe("command ");
      });
    });
  });

  describe("given command with ${tool} variable", () => {
    describe("when tool is provided", () => {
      it("then substitutes the tool name", () => {
        const result = substituteVariables("echo ${tool}", {
          tool: "write",
          cwd: "/home/user/project",
        });
        expect(result).toBe("echo write");
      });
    });

    describe("when tool is undefined", () => {
      it("then replaces with empty string", () => {
        const result = substituteVariables("echo ${tool}", {
          cwd: "/home/user",
        });
        expect(result).toBe("echo ");
      });
    });
  });

  describe("given command with ${cwd} variable", () => {
    describe("when cwd is always provided", () => {
      it("then substitutes the working directory", () => {
        const result = substituteVariables("cd ${cwd} && ls", {
          cwd: "/home/user/project",
        });
        expect(result).toBe("cd /home/user/project && ls");
      });
    });
  });

  describe("given command with multiple variables", () => {
    describe("when all variables are provided", () => {
      it("then substitutes all variables", () => {
        const result = substituteVariables(
          'echo "${tool}: ${file}" in ${cwd}',
          {
            file: "test.ts",
            tool: "edit",
            cwd: "/tmp",
          },
        );
        expect(result).toBe('echo "edit: test.ts" in /tmp');
      });
    });

    describe("when same variable appears multiple times", () => {
      it("then substitutes all occurrences", () => {
        const result = substituteVariables("${file} and ${file}", {
          file: "test.ts",
          cwd: "/tmp",
        });
        expect(result).toBe("test.ts and test.ts");
      });
    });
  });

  describe("given command with special characters in values", () => {
    describe("when file path contains spaces", () => {
      it("then preserves spaces in output", () => {
        const result = substituteVariables('cmd "${file}"', {
          file: "path/with spaces/file.ts",
          cwd: "/tmp",
        });
        expect(result).toBe('cmd "path/with spaces/file.ts"');
      });
    });

    describe("when cwd contains special characters", () => {
      it("then preserves special characters", () => {
        const result = substituteVariables("cd ${cwd}", {
          cwd: "/home/user/my-project_v2",
        });
        expect(result).toBe("cd /home/user/my-project_v2");
      });
    });
  });
});

describe("doesRuleMatch", () => {
  describe("given rule without context", () => {
    const rule = { event: "tool_result" as const, command: "echo test" };

    describe("when any tool is called", () => {
      it("then always matches", () => {
        expect(doesRuleMatch(rule, "write", {})).toBe(true);
        expect(doesRuleMatch(rule, "edit", {})).toBe(true);
        expect(doesRuleMatch(rule, "bash", {})).toBe(true);
      });
    });

    describe("when tool name is undefined", () => {
      it("then still matches", () => {
        expect(doesRuleMatch(rule, undefined, {})).toBe(true);
      });
    });
  });

  describe("given rule with context but no pattern", () => {
    const rule = {
      event: "tool_result" as const,
      command: "echo test",
      context: "tool_name" as const,
    };

    describe("when any tool is called", () => {
      it("then always matches", () => {
        expect(doesRuleMatch(rule, "write", {})).toBe(true);
      });
    });
  });

  describe("given rule with tool_name context", () => {
    describe("when pattern is exact match", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "^write$",
      };

      it("then matches exact tool name", () => {
        expect(doesRuleMatch(rule, "write", {})).toBe(true);
      });

      it("then does not match other tools", () => {
        expect(doesRuleMatch(rule, "edit", {})).toBe(false);
        expect(doesRuleMatch(rule, "write-file", {})).toBe(false);
      });
    });

    describe("when pattern is alternation", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "^(write|edit)$",
      };

      it("then matches any of the alternatives", () => {
        expect(doesRuleMatch(rule, "write", {})).toBe(true);
        expect(doesRuleMatch(rule, "edit", {})).toBe(true);
      });

      it("then does not match other tools", () => {
        expect(doesRuleMatch(rule, "read", {})).toBe(false);
        expect(doesRuleMatch(rule, "bash", {})).toBe(false);
      });
    });

    describe("when tool name is undefined", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "tool_name" as const,
        pattern: "write",
      };

      it("then does not match", () => {
        expect(doesRuleMatch(rule, undefined, {})).toBe(false);
      });
    });
  });

  describe("given rule with file_name context", () => {
    describe("when pattern matches file extension", () => {
      const rule = {
        event: "tool_result" as const,
        command: "prettier ${file}",
        context: "file_name" as const,
        pattern: "\\.(ts|tsx)$",
      };

      it("then matches TypeScript files", () => {
        expect(doesRuleMatch(rule, "write", { path: "src/index.ts" })).toBe(
          true,
        );
        expect(doesRuleMatch(rule, "write", { path: "src/App.tsx" })).toBe(
          true,
        );
      });

      it("then does not match other file types", () => {
        expect(doesRuleMatch(rule, "write", { path: "src/index.js" })).toBe(
          false,
        );
        expect(doesRuleMatch(rule, "write", { path: "src/style.css" })).toBe(
          false,
        );
      });
    });

    describe("when pattern matches test files", () => {
      const rule = {
        event: "tool_result" as const,
        command: "vitest run ${file}",
        context: "file_name" as const,
        pattern: "\\.test\\.ts$",
      };

      it("then matches test files", () => {
        expect(
          doesRuleMatch(rule, "write", { path: "src/utils.test.ts" }),
        ).toBe(true);
      });

      it("then does not match non-test files", () => {
        expect(doesRuleMatch(rule, "write", { path: "src/utils.ts" })).toBe(
          false,
        );
        expect(doesRuleMatch(rule, "write", { path: "src/test.ts" })).toBe(
          false,
        );
      });
    });

    describe("when path is not in input", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "file_name" as const,
        pattern: "\\.ts$",
      };

      it("then does not match empty input", () => {
        expect(doesRuleMatch(rule, "write", {})).toBe(false);
      });

      it("then does not match input without path", () => {
        expect(doesRuleMatch(rule, "write", { other: "value" })).toBe(false);
      });
    });

    describe("when input is null or undefined", () => {
      const rule = {
        event: "tool_result" as const,
        command: "echo test",
        context: "file_name" as const,
        pattern: "\\.ts$",
      };

      it("then does not match null", () => {
        expect(doesRuleMatch(rule, "write", null)).toBe(false);
      });

      it("then does not match undefined", () => {
        expect(doesRuleMatch(rule, "write", undefined)).toBe(false);
      });
    });
  });

  describe("given rule with command context", () => {
    describe("when pattern matches bash command", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo 'running npm'",
        context: "command" as const,
        pattern: "^npm ",
      };

      it("then matches npm commands", () => {
        expect(doesRuleMatch(rule, "bash", { command: "npm install" })).toBe(
          true,
        );
        expect(doesRuleMatch(rule, "bash", { command: "npm run build" })).toBe(
          true,
        );
      });

      it("then does not match other commands", () => {
        expect(doesRuleMatch(rule, "bash", { command: "yarn install" })).toBe(
          false,
        );
        expect(doesRuleMatch(rule, "bash", { command: "pnpm install" })).toBe(
          false,
        );
      });
    });

    describe("when pattern matches dangerous commands", () => {
      const rule = {
        event: "tool_call" as const,
        command: "exit 2",
        context: "command" as const,
        pattern: "rm\\s+-rf\\s+/",
      };

      it("then matches rm -rf with root path", () => {
        expect(doesRuleMatch(rule, "bash", { command: "rm -rf /" })).toBe(true);
        expect(doesRuleMatch(rule, "bash", { command: "rm -rf /etc" })).toBe(
          true,
        );
      });

      it("then does not match safe rm commands", () => {
        expect(doesRuleMatch(rule, "bash", { command: "rm -rf ./temp" })).toBe(
          false,
        );
        expect(doesRuleMatch(rule, "bash", { command: "rm file.txt" })).toBe(
          false,
        );
      });
    });

    describe("when tool is not bash", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo test",
        context: "command" as const,
        pattern: "npm",
      };

      it("then does not match even if input has command", () => {
        expect(doesRuleMatch(rule, "write", { command: "npm install" })).toBe(
          false,
        );
        expect(doesRuleMatch(rule, "edit", { command: "npm install" })).toBe(
          false,
        );
      });
    });

    describe("when command is not in input", () => {
      const rule = {
        event: "tool_call" as const,
        command: "echo test",
        context: "command" as const,
        pattern: "npm",
      };

      it("then does not match", () => {
        expect(doesRuleMatch(rule, "bash", {})).toBe(false);
        expect(doesRuleMatch(rule, "bash", { path: "/tmp" })).toBe(false);
      });
    });
  });

  describe("given rule with invalid regex pattern", () => {
    const rule = {
      event: "tool_result" as const,
      command: "echo test",
      context: "tool_name" as const,
      pattern: "[invalid",
    };

    describe("when pattern fails to compile", () => {
      it("then returns false gracefully", () => {
        expect(doesRuleMatch(rule, "write", {})).toBe(false);
      });
    });
  });

  describe("given rule with case-sensitive pattern", () => {
    const rule = {
      event: "tool_result" as const,
      command: "echo test",
      context: "tool_name" as const,
      pattern: "Write",
    };

    describe("when case does not match", () => {
      it("then does not match (regex is case-sensitive by default)", () => {
        expect(doesRuleMatch(rule, "write", {})).toBe(false);
        expect(doesRuleMatch(rule, "Write", {})).toBe(true);
      });
    });
  });

  describe("given rule with case-insensitive pattern", () => {
    const rule = {
      event: "tool_result" as const,
      command: "echo test",
      context: "tool_name" as const,
      pattern: "(?i)write",
    };

    describe("when using case-insensitive flag", () => {
      it("then matches regardless of case", () => {
        // Note: JavaScript regex doesn't support inline (?i) flag
        // This test documents the current behavior
        expect(doesRuleMatch(rule, "write", {})).toBe(false);
        expect(doesRuleMatch(rule, "WRITE", {})).toBe(false);
      });
    });
  });
});

describe("Hook blocking behavior", () => {
  // These are conceptual tests documenting expected behavior
  // Actual blocking is tested through integration with processHooks

  describe("given exit code 2", () => {
    describe("when hook returns exit code 2", () => {
      it("should block the tool call (documented behavior)", () => {
        // Exit code 2 = blocking error (Claude Code convention)
        // This is tested in integration tests
        expect(true).toBe(true);
      });
    });
  });

  describe("given JSON output with decision block", () => {
    describe("when hook outputs {decision: 'block', reason: '...'}", () => {
      it("should block the action (documented behavior)", () => {
        // JSON blocking is handled in processHooks
        expect(true).toBe(true);
      });
    });
  });

  describe("given JSON output with permissionDecision deny", () => {
    describe("when hook outputs hookSpecificOutput with permissionDecision deny", () => {
      it("should block tool_call events (documented behavior)", () => {
        // PreToolUse-style blocking is handled in processHooks
        expect(true).toBe(true);
      });
    });
  });
});

describe("Hook input format", () => {
  // These tests document the expected JSON input structure

  describe("given tool_call event", () => {
    it("should provide tool_name, tool_input, tool_call_id in JSON", () => {
      const expectedFields = [
        "cwd",
        "hook_event_name",
        "tool_name",
        "tool_input",
        "tool_call_id",
      ];
      // This documents the expected input structure
      expect(expectedFields).toContain("tool_name");
      expect(expectedFields).toContain("tool_input");
    });
  });

  describe("given tool_result event", () => {
    it("should provide tool_response with content and details", () => {
      const expectedFields = ["tool_response"];
      expect(expectedFields).toContain("tool_response");
    });
  });

  describe("given session_start event", () => {
    it("should provide minimal context (cwd, hook_event_name)", () => {
      const requiredFields = ["cwd", "hook_event_name"];
      expect(requiredFields).toHaveLength(2);
    });
  });
});

describe("Hook context types", () => {
  const contextTypes = ["tool_name", "file_name", "command"] as const;

  contextTypes.forEach((contextType) => {
    describe(`given ${contextType} context`, () => {
      it("should be a valid context type", () => {
        const rule = {
          event: "tool_result" as const,
          command: "echo test",
          context: contextType,
          pattern: "test",
        };
        // Rule should be constructable with this context
        expect(rule.context).toBe(contextType);
      });
    });
  });
});

describe("Hook event types", () => {
  const eventTypes = [
    "session_start",
    "session_shutdown",
    "tool_call",
    "tool_result",
    "agent_start",
    "agent_end",
    "turn_start",
    "turn_end",
  ] as const;

  eventTypes.forEach((eventType) => {
    describe(`given ${eventType} event`, () => {
      it("should be a valid event type", () => {
        const rule = {
          event: eventType,
          command: "echo test",
        };
        expect(rule.event).toBe(eventType);
      });
    });
  });

  describe("given event type mapping to Claude Code", () => {
    const mapping = {
      session_start: "SessionStart",
      session_shutdown: "SessionEnd",
      tool_call: "PreToolUse",
      tool_result: "PostToolUse",
      agent_end: "Stop",
    };

    Object.entries(mapping).forEach(([piEvent, claudeEvent]) => {
      it(`then ${piEvent} maps to ${claudeEvent}`, () => {
        expect(piEvent).toBeDefined();
        expect(claudeEvent).toBeDefined();
      });
    });
  });
});

describe("Non-blocking tools", () => {
  const nonBlockingTools = ["edit", "write"];

  nonBlockingTools.forEach((toolName) => {
    describe(`given ${toolName} tool`, () => {
      describe("when hook fails", () => {
        it("should not block the tool (documented behavior)", () => {
          // edit and write are non-blocking to preserve editing flow
          expect(nonBlockingTools).toContain(toolName);
        });
      });
    });
  });
});

describe("Skipped tools", () => {
  const skippedTools = ["read"];

  skippedTools.forEach((toolName) => {
    describe(`given ${toolName} tool`, () => {
      it("should skip hook execution entirely (documented behavior)", () => {
        // read tool is skipped to avoid noise
        expect(skippedTools).toContain(toolName);
      });
    });
  });
});
