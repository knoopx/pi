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
        expect(coreutilsGroup!.rules.length).toBe(2);
      });
    });

    describe("when checking find command rule", () => {
      const findRule = coreutilsGroup!.rules.find((r) =>
        r.pattern.startsWith("^find"),
      );

      it("then blocks find commands with helpful alternatives", () => {
        expect(findRule).toBeDefined();
        expect(findRule!.context).toBe("command");
        expect(findRule!.action).toBe("block");
        expect(findRule!.reason).toContain("fd");
        expect(findRule!.reason).toContain("Examples:");
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

      it("then blocks grep commands with helpful alternatives", () => {
        expect(grepRule).toBeDefined();
        expect(grepRule!.context).toBe("command");
        expect(grepRule!.action).toBe("block");
        expect(grepRule!.reason).toContain("rg");
        expect(grepRule!.reason).toContain("ripgrep");
        expect(grepRule!.reason).toContain("Examples:");
      });

      it("then pattern matches grep commands", () => {
        const regex = new RegExp(grepRule!.pattern);
        expect(regex.test("grep -r 'pattern' .")).toBe(true);
        expect(regex.test("grep 'test' file.txt")).toBe(true);
        expect(regex.test("rg 'pattern' .")).toBe(false);
      });
    });
  });

  describe("given ast-grep group", () => {
    const astGrepGroup = typedDefaults.find((g) => g.group === "ast-grep");

    describe("when group exists", () => {
      it("then is active for all projects", () => {
        expect(astGrepGroup).toBeDefined();
        expect(astGrepGroup!.pattern).toBe("*");
        expect(astGrepGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking import/require grep rule", () => {
      const importGrepRule = astGrepGroup!.rules[0];

      it("then blocks grep for imports with ast-grep alternative", () => {
        expect(importGrepRule.context).toBe("command");
        expect(importGrepRule.action).toBe("block");
        expect(importGrepRule.reason).toContain("ast-grep");
        expect(importGrepRule.reason).toContain("AST-aware");
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

      it("then blocks npm commands with bun alternatives", () => {
        expect(npmRule.context).toBe("command");
        expect(npmRule.action).toBe("block");
        expect(npmRule.reason).toContain("bun");
        expect(npmRule.reason).toContain("bun add");
        expect(npmRule.reason).toContain("bun run");
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

  describe("given vitest group", () => {
    const vitestGroup = typedDefaults.find((g) => g.group === "vitest");

    describe("when group exists", () => {
      it("then is active for bun projects", () => {
        expect(vitestGroup).toBeDefined();
        expect(vitestGroup!.pattern).toBe("bun.lock");
        expect(vitestGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking bun test rule", () => {
      const bunTestRule = vitestGroup!.rules[0];

      it("then blocks bun test with vitest alternatives", () => {
        expect(bunTestRule.context).toBe("command");
        expect(bunTestRule.action).toBe("block");
        expect(bunTestRule.reason).toContain("vitest");
        expect(bunTestRule.reason).toContain("bun vitest run");
      });

      it("then pattern matches bun test commands", () => {
        const regex = new RegExp(bunTestRule.pattern);
        expect(regex.test("bun test")).toBe(true);
        expect(regex.test("bun test --watch")).toBe(true);
        expect(regex.test("bun vitest run")).toBe(false);
      });
    });
  });

  describe("given uv group", () => {
    const uvGroup = typedDefaults.find((g) => g.group === "uv");

    describe("when group exists", () => {
      it("then is active for projects with pyproject.toml", () => {
        expect(uvGroup).toBeDefined();
        expect(uvGroup!.pattern).toBe("pyproject.toml");
        expect(uvGroup!.rules.length).toBe(2);
      });
    });

    describe("when checking python command rule", () => {
      const pythonRule = uvGroup!.rules.find((r) =>
        r.pattern.startsWith("^python"),
      );

      it("then blocks python commands with uv run alternatives", () => {
        expect(pythonRule).toBeDefined();
        expect(pythonRule!.context).toBe("command");
        expect(pythonRule!.action).toBe("block");
        expect(pythonRule!.reason).toContain("uv run");
        expect(pythonRule!.reason).toContain("uv run python");
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

      it("then blocks pip commands with uv alternatives", () => {
        expect(pipRule).toBeDefined();
        expect(pipRule!.context).toBe("command");
        expect(pipRule!.action).toBe("block");
        expect(pipRule!.reason).toContain("uv");
        expect(pipRule!.reason).toContain("uv add");
      });

      it("then pattern matches pip commands", () => {
        const regex = new RegExp(pipRule!.pattern);
        expect(regex.test("pip install requests")).toBe(true);
        expect(regex.test("pip freeze")).toBe(true);
        expect(regex.test("uv pip install requests")).toBe(false);
      });
    });
  });

  describe("given nix group", () => {
    const nixGroup = typedDefaults.find((g) => g.group === "nix");

    describe("when group exists", () => {
      it("then is active for flake projects", () => {
        expect(nixGroup).toBeDefined();
        expect(nixGroup!.pattern).toBe("flake.nix");
        expect(nixGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking nix flake path rule", () => {
      const flakeRule = nixGroup!.rules[0];

      it("then blocks nix commands without path: prefix", () => {
        expect(flakeRule.context).toBe("command");
        expect(flakeRule.action).toBe("block");
        expect(flakeRule.reason).toContain("path:");
        expect(flakeRule.reason).toContain("nix run path:.");
      });

      it("then pattern matches nix commands targeting local flakes", () => {
        const regex = new RegExp(flakeRule.pattern);
        expect(regex.test("nix run .")).toBe(true);
        expect(regex.test("nix build .")).toBe(true);
        expect(regex.test("nix develop .")).toBe(true);
        expect(regex.test("nix run path:.")).toBe(false);
        expect(regex.test("nix build path:.#pkg")).toBe(false);
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

      it("then blocks privilege escalation with helpful guidance", () => {
        expect(privilegeRule.context).toBe("command");
        expect(privilegeRule.action).toBe("block");
        expect(privilegeRule.reason).toContain("cannot perform privileged");
        expect(privilegeRule.reason).toContain("nh os switch");
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

      it("then blocks editing lock files with package manager commands", () => {
        expect(lockRule.context).toBe("file_name");
        expect(lockRule.action).toBe("block");
        expect(lockRule.reason).toContain("auto-generated");
        expect(lockRule.reason).toContain("bun install");
        expect(lockRule.reason).toContain("uv sync");
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

      it("then blocks skipped tests with helpful guidance", () => {
        expect(skipRule.context).toBe("file_content");
        expect(skipRule.action).toBe("block");
        expect(skipRule.reason).toContain("skipped tests");
        expect(skipRule.reason).toContain("it.todo");
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
        expect(lintingGroup!.pattern).toBe("eslint.config.js");
        expect(lintingGroup!.rules.length).toBe(1);
      });
    });

    describe("when checking eslint-disable rule", () => {
      const disableRule = lintingGroup!.rules[0];

      it("then blocks eslint disable with fix guidance", () => {
        expect(disableRule.context).toBe("file_content");
        expect(disableRule.action).toBe("block");
        expect(disableRule.reason).toContain("fix linting issues");
        expect(disableRule.reason).toContain("eslint --fix");
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

    describe("when checking revert rule", () => {
      const revertRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("revert"),
      );

      it("then blocks jj revert with alternatives", () => {
        expect(revertRule).toBeDefined();
        expect(revertRule!.context).toBe("command");
        expect(revertRule!.action).toBe("block");
        expect(revertRule!.reason).toContain("jj undo");
        expect(revertRule!.reason).toContain("jj abandon");
      });
    });

    describe("when checking restore rule", () => {
      const restoreRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("restore"),
      );

      it("then blocks jj restore with alternatives", () => {
        expect(restoreRule).toBeDefined();
        expect(restoreRule!.context).toBe("command");
        expect(restoreRule!.action).toBe("block");
        expect(restoreRule!.reason).toContain("jj edit");
        expect(restoreRule!.reason).toContain("jj new --before");
      });
    });

    describe("when checking squash rule", () => {
      const squashRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("squash"),
      );

      it("then blocks jj squash without -m with alternatives", () => {
        expect(squashRule).toBeDefined();
        expect(squashRule!.context).toBe("command");
        expect(squashRule!.action).toBe("block");
        expect(squashRule!.reason).toContain("jj squash -m");
        expect(squashRule!.reason).toContain("jj absorb");
      });
    });

    describe("when checking describe rule", () => {
      const describeRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("describe"),
      );

      it("then blocks jj describe without -m with conventional commit example", () => {
        expect(describeRule).toBeDefined();
        expect(describeRule!.context).toBe("command");
        expect(describeRule!.action).toBe("block");
        expect(describeRule!.reason).toContain("jj describe -m");
        expect(describeRule!.reason).toContain("type(scope)");
      });
    });

    describe("when checking interactive commands", () => {
      const interactiveRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("--interactive"),
      );

      it("then blocks interactive jj commands with alternatives", () => {
        expect(interactiveRule).toBeDefined();
        expect(interactiveRule!.context).toBe("command");
        expect(interactiveRule!.action).toBe("block");
        expect(interactiveRule!.reason).toContain("interactive");
        expect(interactiveRule!.reason).toContain("jj absorb");
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
        expect(resolveRule!.reason).toContain("jj resolve --list");
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
      });
    });
  });

  describe("given block reasons quality", () => {
    describe("when checking reason helpfulness", () => {
      it("then all reasons provide actionable alternatives", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            // Reasons should be descriptive (more than just "blocked")
            expect(rule.reason.length).toBeGreaterThan(15);
            // Most reasons should mention an alternative tool or approach
            const hasAlternative =
              rule.reason.includes("Use") ||
              rule.reason.includes("use") ||
              rule.reason.includes("instead") ||
              rule.reason.includes("Example");
            expect(hasAlternative).toBe(true);
          });
        });
      });
    });
  });
});
