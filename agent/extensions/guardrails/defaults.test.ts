import { describe, it, expect } from "vitest";
import defaults from "./defaults.json";
import type { GuardrailsConfig } from "./config";

const typedDefaults = defaults as GuardrailsConfig;

describe("Guardrails Defaults Configuration", () => {
  describe("given defaults.json structure", () => {
    describe("when loaded as module", () => {
      it("then is an array of groups", () => {
        expect(Array.isArray(typedDefaults)).toBe(true);
        expect(typedDefaults.length).toBeGreaterThan(0);
      });

      it("then each item is a valid group object", () => {
        typedDefaults.forEach((group) => {
          expect(typeof group).toBe("object");
          expect(group).not.toBeNull();
          expect(typeof group.group).toBe("string");
          expect(group.group.length).toBeGreaterThan(0);
          expect(typeof group.pattern).toBe("string");
          expect(Array.isArray(group.rules)).toBe(true);
          expect(group.rules.length).toBeGreaterThan(0);

          group.rules.forEach((rule) => {
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

    describe("when checking find command rules", () => {
      const findRules = coreutilsGroup!.rules.filter((r) =>
        r.pattern.startsWith("^find"),
      );

      it("then has rules for find commands", () => {
        expect(findRules.length).toBe(2);
      });

      it("then blocks find without head pipe", () => {
        const headRule = findRules.find((r) => r.excludes === "\\| head");
        expect(headRule).toBeDefined();
        expect(headRule!.action).toBe("block");
        expect(headRule!.reason).toContain("head");
      });

      it("then blocks find without node_modules exclusion", () => {
        const nmRule = findRules.find((r) => r.excludes === "node_modules");
        expect(nmRule).toBeDefined();
        expect(nmRule!.action).toBe("block");
        expect(nmRule!.reason).toContain("node_modules");
      });

      it("then pattern matches find commands", () => {
        const regex = new RegExp(findRules[0].pattern);
        expect(regex.test("find . -name '*.ts'")).toBe(true);
        expect(regex.test("find /tmp -type f")).toBe(true);
        expect(regex.test("fd . -e ts")).toBe(false);
      });
    });
  });

  describe("given ast-grep group", () => {
    const astGrepGroup = typedDefaults.find((g) => g.group === "ast-grep");

    describe("when group exists", () => {
      it("then is active for all projects", () => {
        expect(astGrepGroup).toBeDefined();
        expect(astGrepGroup!.pattern).toBe("*");
        expect(astGrepGroup!.rules.length).toBe(2);
      });
    });

    describe("when checking import/require grep rule", () => {
      const importGrepRule = astGrepGroup!.rules.find((r) =>
        r.pattern.includes("import"),
      );

      it("then blocks grep for imports with ast-grep alternative", () => {
        expect(importGrepRule).toBeDefined();
        expect(importGrepRule!.context).toBe("command");
        expect(importGrepRule!.action).toBe("block");
        expect(importGrepRule!.reason).toContain("ast-grep");
        expect(importGrepRule!.reason).toContain("AST");
      });
    });

    describe("when checking grep node_modules rule", () => {
      const grepNmRule = astGrepGroup!.rules.find(
        (r) => r.excludes === "node_modules",
      );

      it("then blocks grep without node_modules exclusion", () => {
        expect(grepNmRule).toBeDefined();
        expect(grepNmRule!.action).toBe("block");
        expect(grepNmRule!.reason).toContain("node_modules");
        expect(grepNmRule!.reason).toContain("--exclude-dir");
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
      });

      it("then pattern matches npm commands", () => {
        const regex = new RegExp(npmRule.pattern);
        expect(regex.test("npm install")).toBe(true);
        expect(regex.test("npm run build")).toBe(true);
        expect(regex.test("bun install")).toBe(false);
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
      });

      it("then pattern matches nix commands targeting local flakes", () => {
        const regex = new RegExp(flakeRule.pattern);
        expect(regex.test("nix run .")).toBe(true);
        expect(regex.test("nix build .")).toBe(true);
        expect(regex.test("nix develop .")).toBe(true);
        expect(regex.test("nix run path:.")).toBe(false);
      });
    });
  });

  describe("given protect-paths group", () => {
    const protectGroup = typedDefaults.find((g) => g.group === "protect-paths");

    describe("when group exists", () => {
      it("then is active for all projects", () => {
        expect(protectGroup).toBeDefined();
        expect(protectGroup!.pattern).toBe("*");
        expect(protectGroup!.rules.length).toBeGreaterThan(3);
      });
    });

    describe("when checking .env file rules", () => {
      const envRules = protectGroup!.rules.filter((r) =>
        r.pattern.includes("\\.env"),
      );

      it("then blocks .env file access", () => {
        expect(envRules.length).toBeGreaterThan(0);
        envRules.forEach((rule) => {
          expect(rule.action).toBe("block");
          expect(rule.reason).toContain("secrets");
        });
      });

      it("then excludes example/sample env files", () => {
        const fileNameRule = envRules.find((r) => r.context === "file_name");
        expect(fileNameRule?.excludes).toContain("example");
      });
    });

    describe("when checking .git/.jj protection", () => {
      const vcsRules = protectGroup!.rules.filter((r) =>
        r.pattern.includes("(git|jj)"),
      );

      it("then blocks direct VCS directory access", () => {
        expect(vcsRules.length).toBeGreaterThan(0);
        vcsRules.forEach((rule) => {
          expect(rule.action).toBe("block");
          expect(rule.reason).toContain("repository");
        });
      });
    });

    describe("when checking node_modules protection", () => {
      const nmRules = protectGroup!.rules.filter((r) =>
        r.pattern.includes("node_modules"),
      );

      it("then blocks node_modules modifications", () => {
        expect(nmRules.length).toBeGreaterThan(0);
        nmRules.forEach((rule) => {
          expect(rule.action).toBe("block");
          expect(rule.reason).toContain("package manager");
        });
      });
    });
  });

  describe("given permission-gate group", () => {
    const permissionGroup = typedDefaults.find(
      (g) => g.group === "permission-gate",
    );

    describe("when group exists", () => {
      it("then is active for all projects", () => {
        expect(permissionGroup).toBeDefined();
        expect(permissionGroup!.pattern).toBe("*");
      });
    });

    describe("when checking dangerous command rules", () => {
      it("then requires confirmation for rm -rf", () => {
        const rmRule = permissionGroup!.rules.find((r) =>
          r.pattern.includes("rm"),
        );
        expect(rmRule).toBeDefined();
        expect(rmRule!.action).toBe("confirm");
        expect(rmRule!.reason).toContain("⚠️");
      });

      it("then requires confirmation for sudo", () => {
        const sudoRule = permissionGroup!.rules.find((r) =>
          r.pattern.includes("sudo"),
        );
        expect(sudoRule).toBeDefined();
        expect(sudoRule!.action).toBe("confirm");
      });

      it("then requires confirmation for piped shell execution", () => {
        const pipeRule = permissionGroup!.rules.find((r) =>
          r.pattern.includes("sh|bash"),
        );
        expect(pipeRule).toBeDefined();
        expect(pipeRule!.action).toBe("confirm");
      });

      it("then requires confirmation for dd", () => {
        const ddRule = permissionGroup!.rules.find((r) =>
          r.pattern.includes("dd"),
        );
        expect(ddRule).toBeDefined();
        expect(ddRule!.action).toBe("confirm");
      });

      it("then requires confirmation for mkfs", () => {
        const mkfsRule = permissionGroup!.rules.find((r) =>
          r.pattern.includes("mkfs"),
        );
        expect(mkfsRule).toBeDefined();
        expect(mkfsRule!.action).toBe("confirm");
      });
    });
  });

  describe("given interactive group", () => {
    const interactiveGroup = typedDefaults.find(
      (g) => g.group === "interactive",
    );

    describe("when group exists", () => {
      it("then is active for all projects", () => {
        expect(interactiveGroup).toBeDefined();
        expect(interactiveGroup!.pattern).toBe("*");
      });
    });

    describe("when checking dev server rules", () => {
      const devRules = interactiveGroup!.rules.filter(
        (r) => r.pattern.includes("dev") || r.pattern.includes("vite"),
      );

      it("then blocks dev servers with tmux alternatives", () => {
        expect(devRules.length).toBeGreaterThan(0);
        devRules.forEach((rule) => {
          expect(rule.action).toBe("block");
          expect(rule.reason).toContain("tmux");
        });
      });
    });

    describe("when checking vitest watch mode", () => {
      const vitestRules = interactiveGroup!.rules.filter((r) =>
        r.pattern.includes("vitest"),
      );

      it("then blocks vitest without run flag", () => {
        expect(vitestRules.length).toBeGreaterThan(0);
        vitestRules.forEach((rule) => {
          expect(rule.action).toBe("block");
          expect(rule.reason).toContain("vitest run");
        });
      });
    });

    describe("when checking REPL rules", () => {
      const replRules = interactiveGroup!.rules.filter(
        (r) =>
          r.pattern.includes("repl") ||
          r.pattern.includes("^node\\s*$") ||
          r.pattern.includes("ipython"),
      );

      it("then blocks REPLs with alternatives", () => {
        expect(replRules.length).toBeGreaterThan(0);
        replRules.forEach((rule) => {
          expect(rule.action).toBe("block");
        });
      });
    });

    describe("when checking editor rules", () => {
      const editorRule = interactiveGroup!.rules.find(
        (r) =>
          r.pattern.includes("vim") ||
          r.pattern.includes("nano") ||
          r.pattern.includes("emacs"),
      );

      it("then blocks editors with edit/write tool alternatives", () => {
        expect(editorRule).toBeDefined();
        expect(editorRule!.action).toBe("block");
        expect(editorRule!.reason).toContain("edit");
        expect(editorRule!.reason).toContain("write");
      });
    });

    describe("when checking system monitor rules", () => {
      const monitorRule = interactiveGroup!.rules.find(
        (r) => r.pattern.includes("htop") || r.pattern.includes("top"),
      );

      it("then blocks system monitors with ps alternatives", () => {
        expect(monitorRule).toBeDefined();
        expect(monitorRule!.action).toBe("block");
        expect(monitorRule!.reason).toContain("ps");
      });
    });

    describe("when checking tail -f rule", () => {
      const tailRule = interactiveGroup!.rules.find((r) =>
        r.pattern.includes("tail"),
      );

      it("then blocks tail -f with tmux alternative", () => {
        expect(tailRule).toBeDefined();
        expect(tailRule!.action).toBe("block");
        expect(tailRule!.reason).toContain("tmux");
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
        expect(disableRule.reason).toContain("eslint --fix");
      });

      it("then pattern matches eslint-disable", () => {
        const regex = new RegExp(disableRule.pattern);
        expect(regex.test("/* eslint-disable */")).toBe(true);
        expect(regex.test("// eslint-disable-next-line")).toBe(true);
        expect(regex.test("/* eslint-enable */")).toBe(false);
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
        expect(revertRule!.action).toBe("block");
        expect(revertRule!.reason).toContain("jj undo");
      });
    });

    describe("when checking squash rule", () => {
      const squashRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("squash"),
      );

      it("then blocks jj squash without -m with alternatives", () => {
        expect(squashRule).toBeDefined();
        expect(squashRule!.action).toBe("block");
        expect(squashRule!.reason).toContain("jj squash -m");
      });
    });

    describe("when checking describe rule", () => {
      const describeRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("describe"),
      );

      it("then blocks jj describe without -m", () => {
        expect(describeRule).toBeDefined();
        expect(describeRule!.action).toBe("block");
        expect(describeRule!.reason).toContain("jj describe -m");
      });
    });

    describe("when checking interactive commands", () => {
      const interactiveRule = jjGroup!.rules.find((r) =>
        r.pattern.includes("--interactive"),
      );

      it("then blocks interactive jj commands with alternatives", () => {
        expect(interactiveRule).toBeDefined();
        expect(interactiveRule!.action).toBe("block");
        expect(interactiveRule!.reason).toContain("jj absorb");
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

      it("then all includes patterns are valid regex", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            if (rule.includes) {
              const pattern = rule.includes;
              expect(() => new RegExp(pattern)).not.toThrow();
            }
          });
        });
      });

      it("then all excludes patterns are valid regex", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            if (rule.excludes) {
              const pattern = rule.excludes;
              expect(() => new RegExp(pattern)).not.toThrow();
            }
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

  describe("given reason message quality", () => {
    describe("when checking helpfulness", () => {
      it("then all reasons are descriptive", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            expect(rule.reason.length).toBeGreaterThan(20);
          });
        });
      });

      it("then block reasons provide actionable alternatives", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            if (rule.action === "block") {
              const hasAlternative =
                rule.reason.toLowerCase().includes("use") ||
                rule.reason.toLowerCase().includes("instead") ||
                rule.reason.toLowerCase().includes("example") ||
                rule.reason.toLowerCase().includes("run") ||
                rule.reason.includes("tmux") ||
                rule.reason.includes("`");
              expect(hasAlternative).toBe(true);
            }
          });
        });
      });

      it("then confirm reasons explain the risk", () => {
        typedDefaults.forEach((group) => {
          group.rules.forEach((rule) => {
            if (rule.action === "confirm") {
              expect(rule.reason).toContain("⚠️");
            }
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
  });
});
