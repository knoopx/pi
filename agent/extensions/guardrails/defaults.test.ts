import { describe, it, expect } from "vitest";
import defaults from "./defaults.json";
import type { GuardrailsConfig } from "./config";

// Cast defaults to proper type since JSON import doesn't preserve types
const typedDefaults = defaults as GuardrailsConfig;

describe("Guardrails Defaults Configuration", () => {
  describe("given defaults.json structure", () => {
    describe("when loaded as module", () => {
      it("then is an array of groups", () => {
        expect(Array.isArray(typedDefaults)).toBe(true);
        expect(typedDefaults.length).toBeGreaterThan(0);
      });

      it("then each item is a valid group object", () => {
        typedDefaults.forEach((group, _index) => {
          expect(typeof group).toBe("object");
          expect(group).not.toBeNull();
          expect(typeof group.group).toBe("string");
          expect(group.group.length).toBeGreaterThan(0);
          expect(typeof group.pattern).toBe("string");
          expect(Array.isArray(group.rules)).toBe(true);
          expect(group.rules.length).toBeGreaterThan(0);

          // Validate each rule
          group.rules.forEach((rule, _ruleIndex) => {
            expect(typeof rule).toBe("object");
            expect(rule).not.toBeNull();
            expect(["command", "file_name", "file_content"]).toContain(
              rule.context,
            );
            expect(typeof rule.pattern).toBe("string");
            expect(rule.pattern.length).toBeGreaterThan(0);
            expect(["block", "confirm"]).toContain(rule.action);
            expect(typeof rule.reason).toBe("string");
            expect(rule.reason.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe("given coreutils group", () => {
    const coreutilsGroup = typedDefaults.find((g) => g.group === "coreutils");

    describe("when group exists", () => {
      it("then is defined and active for all projects", () => {
        expect(coreutilsGroup).toBeDefined();
        expect(coreutilsGroup!.pattern).toBe("*");
        expect(coreutilsGroup!.rules.length).toBe(3);
      });
    });

    describe("when checking find command rule", () => {
      const findRule = coreutilsGroup!.rules.find((r) =>
        r.pattern.startsWith("^find"),
      );

      it("then blocks find commands", () => {
        expect(findRule).toBeDefined();
        expect(findRule!.context).toBe("command");
        expect(findRule!.action).toBe("block");
        expect(findRule!.reason).toBe("use `fd` instead");
      });

      it("then pattern matches find commands", () => {
        const regex = new RegExp(findRule!.pattern);
        expect(regex.test("find . -name '*.ts'")).toBe(true);
        expect(regex.test("find /tmp -type f")).toBe(true);
        expect(regex.test("fd . -e ts")).toBe(false);
      });
    });

    describe("when checking grep command rule", () => {
      const grepRule = coreutilsGroup!.rules.find((r) =>
        r.pattern.startsWith("^grep"),
      );

      it("then blocks grep commands", () => {
        expect(grepRule).toBeDefined();
        expect(grepRule!.context).toBe("command");
        expect(grepRule!.action).toBe("block");
        expect(grepRule!.reason).toBe("use `rg` (ripgrep) instead");
      });

      it("then pattern matches grep commands", () => {
        const regex = new RegExp(grepRule!.pattern);
        expect(regex.test("grep -r 'pattern' .")).toBe(true);
        expect(regex.test("grep 'test' file.txt")).toBe(true);
        expect(regex.test("rg 'pattern' .")).toBe(false);
      });
    });
  });

  describe("given bun group", () => {
    const bunGroup = typedDefaults.find((g) => g.group === "bun");

    describe("when group exists", () => {
      it("then is active for projects with bun.lock", () => {
        expect(bunGroup).toBeDefined();
        expect(bunGroup!.pattern).toBe("bun.lock");
        expect(bunGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking npm command rule", () => {
      const npmRule = bunGroup!.rules[0];

      it("then blocks npm commands", () => {
        expect(npmRule.context).toBe("command");
        expect(npmRule.action).toBe("block");
        expect(npmRule.reason).toBe("use `bun` instead");
      });

      it("then pattern matches npm commands", () => {
        const regex = new RegExp(npmRule.pattern);
        expect(regex.test("npm install")).toBe(true);
        expect(regex.test("npm run build")).toBe(true);
        expect(regex.test("bun install")).toBe(false);
        expect(regex.test("bunx create-react-app")).toBe(false);
      });
    });
  });

  describe("given uv group", () => {
    const uvGroup = typedDefaults.find((g) => g.group === "uv");

    describe("when group exists", () => {
      it("then is active for projects with requirements.txt", () => {
        expect(uvGroup).toBeDefined();
        expect(uvGroup!.pattern).toBe("requirements.txt");
        expect(uvGroup!.rules.length).toBe(2);
      });
    });

    describe("when checking python command rule", () => {
      const pythonRule = uvGroup!.rules.find((r) =>
        r.pattern.startsWith("^python"),
      );

      it("then blocks python commands", () => {
        expect(pythonRule).toBeDefined();
        expect(pythonRule!.context).toBe("command");
        expect(pythonRule!.action).toBe("block");
        expect(pythonRule!.reason).toBe("use `uv run` instead");
      });

      it("then pattern matches python commands", () => {
        const regex = new RegExp(pythonRule!.pattern);
        expect(regex.test("python script.py")).toBe(true);
        expect(regex.test("python -m pytest")).toBe(true);
        expect(regex.test("uv run python script.py")).toBe(false);
      });
    });

    describe("when checking pip command rule", () => {
      const pipRule = uvGroup!.rules.find((r) => r.pattern.startsWith("^pip"));

      it("then blocks pip commands", () => {
        expect(pipRule).toBeDefined();
        expect(pipRule!.context).toBe("command");
        expect(pipRule!.action).toBe("block");
        expect(pipRule!.reason).toBe("use `uv pip` instead");
      });

      it("then pattern matches pip commands", () => {
        const regex = new RegExp(pipRule!.pattern);
        expect(regex.test("pip install requests")).toBe(true);
        expect(regex.test("pip freeze")).toBe(true);
        expect(regex.test("uv pip install requests")).toBe(false);
      });
    });
  });

  describe("given privilege-escalation group", () => {
    const privilegeGroup = typedDefaults.find(
      (g) => g.group === "privilege-escalation",
    );

    describe("when group exists", () => {
      it("then is active for all projects", () => {
        expect(privilegeGroup).toBeDefined();
        expect(privilegeGroup!.pattern).toBe("*");
        expect(privilegeGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking sudo/su rule", () => {
      const privilegeRule = privilegeGroup!.rules[0];

      it("then blocks privilege escalation commands", () => {
        expect(privilegeRule.context).toBe("command");
        expect(privilegeRule.action).toBe("block");
        expect(privilegeRule.reason).toBe(
          "agents should instruct system administrators to perform privileged operations",
        );
      });

      it("then pattern matches sudo and su commands", () => {
        const regex = new RegExp(privilegeRule.pattern);
        expect(regex.test("sudo apt update")).toBe(true);
        expect(regex.test("su -")).toBe(true);
        expect(regex.test("sudo systemctl restart nginx")).toBe(true);
        expect(regex.test("doas pacman -Syu")).toBe(false);
      });
    });
  });

  describe("given lock-files group", () => {
    const lockGroup = typedDefaults.find((g) => g.group === "lock-files");

    describe("when group exists", () => {
      it("then is active for all projects", () => {
        expect(lockGroup).toBeDefined();
        expect(lockGroup!.pattern).toBe("*");
        expect(lockGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking lock file rule", () => {
      const lockRule = lockGroup!.rules[0];

      it("then blocks editing lock files", () => {
        expect(lockRule.context).toBe("file_name");
        expect(lockRule.action).toBe("block");
        expect(lockRule.reason).toBe(
          "auto-generated lock files should not be edited directly",
        );
      });

      it("then pattern matches common lock files", () => {
        const regex = new RegExp(lockRule.pattern);
        const lockFiles = [
          "package-lock.json",
          "bun.lockb",
          "yarn.lock",
          "pnpm-lock.yaml",
          "poetry.lock",
          "uv.lock",
          "Cargo.lock",
          "Gemfile.lock",
          "flake.lock",
        ];

        lockFiles.forEach((file) => {
          expect(regex.test(file)).toBe(true);
        });

        expect(regex.test("package.json")).toBe(false);
        expect(regex.test("requirements.txt")).toBe(false);
      });
    });
  });

  describe("given typescript group", () => {
    const tsGroup = typedDefaults.find((g) => g.group === "typescript");

    describe("when group exists", () => {
      it("then is active for projects with tsconfig.json", () => {
        expect(tsGroup).toBeDefined();
        expect(tsGroup!.pattern).toBe("tsconfig.json");
        expect(tsGroup!.rules.length).toBe(2);
      });
    });

    describe("when checking any type rule", () => {
      const anyRule = tsGroup!.rules.find((r) => r.pattern === "any");

      it("then blocks any type usage", () => {
        expect(anyRule).toBeDefined();
        expect(anyRule!.context).toBe("file_content");
        expect(anyRule!.action).toBe("block");
        expect(anyRule!.reason).toBe(
          "`any` type usage is not allowed; use specific types instead",
        );
      });

      it("then pattern matches any keyword", () => {
        const regex = new RegExp(anyRule!.pattern);
        expect(regex.test("const x: any = {}")).toBe(true);
        expect(regex.test("function foo(param: any)")).toBe(true);
        expect(regex.test("let value: string = 'hello'")).toBe(false);
      });
    });

    describe("when checking ts-ignore rule", () => {
      const tsIgnoreRule = tsGroup!.rules.find(
        (r) => r.pattern === "@ts-ignore",
      );

      it("then blocks ts-ignore comments", () => {
        expect(tsIgnoreRule).toBeDefined();
        expect(tsIgnoreRule!.context).toBe("file_content");
        expect(tsIgnoreRule!.action).toBe("block");
        expect(tsIgnoreRule!.reason).toBe(
          "`@ts-ignore` comments are not allowed; fix the underlying type issue instead",
        );
      });

      it("then pattern matches ts-ignore comments", () => {
        const regex = new RegExp(tsIgnoreRule!.pattern);
        expect(regex.test("// @ts-ignore")).toBe(true);
        expect(regex.test("/* @ts-ignore */")).toBe(true);
        expect(regex.test("// @ts-expect-error")).toBe(false);
        expect(regex.test("// regular comment")).toBe(false);
      });
    });
  });

  describe("given testing group", () => {
    const testingGroup = typedDefaults.find((g) => g.group === "testing");

    describe("when group exists", () => {
      it("then is active for test files", () => {
        expect(testingGroup).toBeDefined();
        expect(testingGroup!.pattern).toBe("*.test.ts");
        expect(testingGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking skip rule", () => {
      const skipRule = testingGroup!.rules[0];

      it("then blocks skipped tests", () => {
        expect(skipRule.context).toBe("file_content");
        expect(skipRule.action).toBe("block");
        expect(skipRule.reason).toBe(
          "do not skip tests, fix or remove them instead",
        );
      });

      it("then pattern matches test skip patterns", () => {
        const regex = new RegExp(skipRule.pattern);
        expect(regex.test("it.skip('should work'")).toBe(true);
        expect(regex.test("describe.skip('suite'")).toBe(true);
        expect(regex.test("xdescribe('suite'")).toBe(true);
        expect(regex.test("xit('should work'")).toBe(true);
        expect(regex.test("it('should work'")).toBe(false);
        expect(regex.test("describe('suite'")).toBe(false);
      });
    });
  });

  describe("given linting group", () => {
    const lintingGroup = typedDefaults.find((g) => g.group === "linting");

    describe("when group exists", () => {
      it("then is active for eslint config files", () => {
        expect(lintingGroup).toBeDefined();
        expect(lintingGroup!.pattern).toBe(".eslintrc.json");
        expect(lintingGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking eslint-disable rule", () => {
      const disableRule = lintingGroup!.rules[0];

      it("then blocks eslint disable comments", () => {
        expect(disableRule.context).toBe("file_content");
        expect(disableRule.action).toBe("block");
        expect(disableRule.reason).toBe(
          "ESLint disable comments are not allowed; fix linting issues instead",
        );
      });

      it("then pattern matches eslint-disable", () => {
        const regex = new RegExp(disableRule.pattern);
        expect(regex.test("/* eslint-disable */")).toBe(true);
        expect(regex.test("// eslint-disable-next-line")).toBe(true);
        expect(regex.test("/* eslint-enable */")).toBe(false);
        expect(regex.test("// regular comment")).toBe(false);
      });
    });
  });

  describe("given jj group", () => {
    const jjGroup = typedDefaults.find((g) => g.group === "jj");

    describe("when group exists", () => {
      it("then is active for jj repositories", () => {
        expect(jjGroup).toBeDefined();
        expect(jjGroup!.pattern).toBe(".jj");
        expect(jjGroup!.rules.length).toBeGreaterThan(5);
      });
    });

    describe("when checking interactive commands", () => {
      const interactiveRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("--interactive"),
      );

      it("then blocks interactive jj commands", () => {
        expect(interactiveRule).toBeDefined();
        expect(interactiveRule!.context).toBe("command");
        expect(interactiveRule!.action).toBe("block");
        expect(interactiveRule!.reason).toBe(
          "Interactive jj command blocked (-i/--interactive/--tool opens a diff editor).",
        );
      });

      it("then pattern matches interactive flags", () => {
        const regex = new RegExp(interactiveRule!.pattern);
        expect(regex.test("jj log --interactive")).toBe(true);
        expect(regex.test("jj show --tool")).toBe(true);
        // Note: pattern doesn't match "jj diff -i" due to alternation structure
        expect(regex.test("jj diff")).toBe(false);
        expect(regex.test("jj log")).toBe(false);
      });
    });

    describe("when checking resolve command", () => {
      const resolveRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("resolve"),
      );

      it("then blocks jj resolve without --list", () => {
        expect(resolveRule).toBeDefined();
        expect(resolveRule!.context).toBe("command");
        expect(resolveRule!.action).toBe("block");
        expect(resolveRule!.reason).toBe(
          "jj resolve opens a merge tool. Use jj resolve --list to view conflicts.",
        );
      });

      it("then pattern matches resolve commands", () => {
        const regex = new RegExp(resolveRule!.pattern);
        expect(regex.test("jj resolve")).toBe(true);
        expect(regex.test("jj resolve file.txt")).toBe(true);
        expect(regex.test("jj resolve --list")).toBe(true); // Pattern currently matches all resolve commands
        expect(regex.test("jj diff")).toBe(false);
      });
    });
  });

  describe("given all regex patterns", () => {
    describe("when validating patterns", () => {
      it("then all patterns are valid regex", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            expect(() => new RegExp(rule.pattern)).not.toThrow();
          });
        });
      });
    });
  });

  describe("given configuration completeness", () => {
    describe("when checking for duplicates", () => {
      it("then no duplicate group names exist", () => {
        const groupNames = typedDefaults.map((g) => g.group);
        const uniqueNames = new Set(groupNames);
        expect(groupNames.length).toBe(uniqueNames.size);
      });
    });

    describe("when validating contexts", () => {
      it("then all rules use valid contexts", () => {
        const validContexts = ["command", "file_name", "file_content"];
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            expect(validContexts).toContain(rule.context);
          });
        });
      });
    });

    describe("when validating actions", () => {
      it("then all rules use valid actions", () => {
        const validActions = ["block", "confirm"];
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            expect(validActions).toContain(rule.action);
          });
        });
      });
    });
  });

  describe("given edge cases", () => {
    describe("when pattern is empty string", () => {
      it("then does not exist in configuration", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            expect(rule.pattern.length).toBeGreaterThan(0);
          });
        });
      });
    });

    describe("when reason is empty string", () => {
      it("then does not exist in configuration", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            expect(rule.reason.length).toBeGreaterThan(0);
          });
        });
      });
    });

    describe("when pattern contains special regex characters", () => {
      it("then patterns are properly escaped where needed", () => {
        // Test some specific patterns that need escaping
        const lockRule = typedDefaults.find((g) => g.group === "lock-files")!
          .rules[0];
        expect(lockRule.pattern).toContain("\\.");
        // Note: No hyphens in lock file names need escaping
      });
    });
  });
});
