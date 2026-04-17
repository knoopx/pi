import { describe, it, expect } from "vitest";
import { tokenizeCommand } from "./tokenizer";
import { matchCommandPattern, parsePattern } from "./pattern-matching";

describe("command-parser", () => {
  describe("tokenizeCommand", () => {
    describe("given env vars and wrappers", () => {
      it("then strips prefixes and keeps executable tokens", () => {
        const segments = tokenizeCommand("FOO=bar env npm install");
        expect(segments).toEqual([["npm", "install"]]);
      });
    });

    describe("given pipelines and logical operators", () => {
      it("then splits into command segments", () => {
        const segments = tokenizeCommand("cd /tmp && npm install | cat");
        expect(segments).toEqual([["cd", "/tmp"], ["npm", "install"], ["cat"]]);
      });
    });

    describe("given empty command", () => {
      it("then returns empty segments", () => {
        expect(tokenizeCommand("")).toEqual([]);
      });
    });
  });

  describe("parsePattern", () => {
    describe("given ast-like tokens", () => {
      it("then parses spread and single placeholders", () => {
        const parsed = parsePattern("npm ? * ");
        expect(parsed).toEqual([
          { kind: "literal", value: "npm" },
          { kind: "single" },
          { kind: "spread" },
        ]);
      });

      it("then parses OR token groups", () => {
        const parsed = parsePattern("{npm,bun} test * ");
        expect(parsed).toEqual([
          { kind: "or", options: [["npm"], ["bun"]] },
          { kind: "literal", value: "test" },
          { kind: "spread" },
        ]);
      });

      it("then evaluates a group with a single option to literal", () => {
        const parsed = parsePattern("{a}");
        expect(parsed).toEqual([{ kind: "literal", value: "a" }]);
      });
    });
  });

  describe("matchCommandPattern", () => {
    describe("given env vars and wrappers", () => {
      it("then strips prefixes and matches the executable", () => {
        expect(
          matchCommandPattern("FOO=bar env npm install", "npm install"),
        ).toBe(true);
      });
    });

    describe("given pipelines and logical operators", () => {
      it("then matches any segment in a pipeline", () => {
        expect(
          matchCommandPattern("cd /tmp && npm install | cat", "npm *"),
        ).toBe(true);
      });
    });

    describe("given literal-only pattern", () => {
      it("then matches exact token sequence", () => {
        expect(matchCommandPattern("npm install", "npm install")).toBe(true);
        expect(matchCommandPattern("npm test", "npm install")).toBe(false);
      });
    });

    describe("given spread placeholder", () => {
      it("then matches zero or more trailing args", () => {
        expect(matchCommandPattern("npm", "npm *")).toBe(true);
        expect(matchCommandPattern("npm install lodash", "npm *")).toBe(true);
      });
    });

    describe("given single placeholder", () => {
      it("then matches exactly one token", () => {
        expect(matchCommandPattern("bun test", "bun ?")).toBe(true);
        expect(matchCommandPattern("bun test --watch", "bun ?")).toBe(false);
      });
    });

    describe("given mixed placeholders", () => {
      it("then supports subcommand matching", () => {
        expect(matchCommandPattern("jj describe -m hi", "jj describe *")).toBe(
          true,
        );
        expect(matchCommandPattern("jj split -m hi", "jj describe *")).toBe(
          false,
        );
      });
    });

    describe("given OR token groups", () => {
      it("then matches any listed token", () => {
        expect(matchCommandPattern("npm install", "{npm,bun} *")).toBe(true);
        expect(matchCommandPattern("bun install", "{npm,bun} *")).toBe(true);
        expect(matchCommandPattern("pnpm install", "{npm,bun} *")).toBe(false);
      });

      it("then supports wildcards inside OR options", () => {
        expect(
          matchCommandPattern("python3.12 script.py", "{python,python3*} *"),
        ).toBe(true);
      });
    });

    describe("given multi-word OR alternatives", () => {
      it("then matches multi-token options", () => {
        expect(
          matchCommandPattern(
            "modal app stop my-app",
            "modal {app stop,volume delete} *",
          ),
        ).toBe(true);
        expect(
          matchCommandPattern(
            "modal volume delete my-vol",
            "modal {app stop,volume delete} *",
          ),
        ).toBe(true);
        expect(
          matchCommandPattern(
            "modal app list",
            "modal {app stop,volume delete} *",
          ),
        ).toBe(false);
      });

      it("then handles mixed single and multi-word options", () => {
        expect(
          matchCommandPattern(
            "zuplo delete --url x",
            "zuplo {delete,tunnel delete,mtls-certificate disable} *",
          ),
        ).toBe(true);
        expect(
          matchCommandPattern(
            "zuplo tunnel delete x",
            "zuplo {delete,tunnel delete,mtls-certificate disable} *",
          ),
        ).toBe(true);
        expect(
          matchCommandPattern(
            "zuplo deploy",
            "zuplo {delete,tunnel delete,mtls-certificate disable} *",
          ),
        ).toBe(false);
      });
    });

    describe("given path-based executable", () => {
      it("then compares literal with basename", () => {
        expect(
          matchCommandPattern("/usr/bin/python3 script.py", "python3 *"),
        ).toBe(true);
      });
    });

    describe("given command inside chain", () => {
      it("then matches any segment", () => {
        expect(matchCommandPattern("cd /tmp && npm install", "npm *")).toBe(
          true,
        );
      });
    });

    describe("given empty pattern", () => {
      it("then does not match", () => {
        expect(matchCommandPattern("npm install", "")).toBe(false);
      });
    });

    describe("given empty command", () => {
      it("then does not match", () => {
        expect(matchCommandPattern("", "npm *")).toBe(false);
      });
    });
  });
});
