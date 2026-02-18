import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseMarkdown,
  loadFileCommands,
  evaluateShellCommands,
} from "./command-file-loader";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

describe("command-file-loader", () => {
  describe("parseMarkdown", () => {
    describe("given content without frontmatter", () => {
      const content = "# Hello World\n\nThis is content.";

      describe("when parsing", () => {
        it("then returns empty frontmatter and full body", () => {
          const result = parseMarkdown(content);

          expect(result.frontmatter).toEqual({});
          expect(result.body).toBe(content);
        });
      });
    });

    describe("given content with unclosed frontmatter", () => {
      const content = "---\ndescription: test\n# No closing marker";

      describe("when parsing", () => {
        it("then returns empty frontmatter and full body", () => {
          const result = parseMarkdown(content);

          expect(result.frontmatter).toEqual({});
          expect(result.body).toBe(content);
        });
      });
    });

    describe("given content with valid frontmatter", () => {
      describe("when frontmatter has description only", () => {
        const content = `---
description: A test command
---

# Template Body

Some content here.`;

        it("then parses description correctly", () => {
          const result = parseMarkdown(content);

          expect(result.frontmatter.description).toBe("A test command");
          expect(result.body).toBe("\n# Template Body\n\nSome content here.");
        });
      });

      describe("when frontmatter has nested args", () => {
        const content = `---
description: Command with args
args:
  from:
    default: main
    description: Starting branch
  to:
    default: HEAD
    description: Ending branch
  format:
    default: overview
    choices:
      - overview
      - detailed
      - summary
---

Template body with $from and $to`;

        it("then parses args structure correctly", () => {
          const result = parseMarkdown(content);

          expect(result.frontmatter.description).toBe("Command with args");
          expect(result.frontmatter.args).toBeDefined();
          expect(result.frontmatter.args?.from).toEqual({
            default: "main",
            description: "Starting branch",
          });
          expect(result.frontmatter.args?.to).toEqual({
            default: "HEAD",
            description: "Ending branch",
          });
          expect(result.frontmatter.args?.format).toEqual({
            default: "overview",
            choices: ["overview", "detailed", "summary"],
          });
        });
      });

      describe("when frontmatter has invalid YAML", () => {
        const content = `---
invalid: [unclosed
---

Body content`;

        it("then returns empty frontmatter and body", () => {
          const result = parseMarkdown(content);

          expect(result.frontmatter).toEqual({});
          expect(result.body).toBe("\nBody content");
        });
      });
    });

    describe("given empty content", () => {
      describe("when parsing", () => {
        it("then returns empty frontmatter and empty body", () => {
          const result = parseMarkdown("");

          expect(result.frontmatter).toEqual({});
          expect(result.body).toBe("");
        });
      });
    });
  });

  describe("loadFileCommands", () => {
    const mockPi = {} as ExtensionAPI;
    let tempDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
      originalHome = process.env.HOME;
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "command-test-"));
      process.env.HOME = tempDir;
      fs.mkdirSync(path.join(tempDir, ".pi", "agent", "commands"), {
        recursive: true,
      });
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    function writeCommand(name: string, content: string): void {
      const commandsDir = path.join(tempDir, ".pi", "agent", "commands");
      fs.writeFileSync(path.join(commandsDir, `${name}.md`), content);
    }

    describe("given commands directory does not exist", () => {
      beforeEach(() => {
        fs.rmSync(path.join(tempDir, ".pi"), { recursive: true, force: true });
      });

      describe("when loading commands", () => {
        it("then returns empty array", () => {
          const result = loadFileCommands(mockPi);

          expect(result).toEqual([]);
        });
      });
    });

    describe("given commands directory is empty", () => {
      describe("when loading commands", () => {
        it("then returns empty array", () => {
          const result = loadFileCommands(mockPi);

          expect(result).toEqual([]);
        });
      });
    });

    describe("given commands directory has markdown files", () => {
      beforeEach(() => {
        writeCommand(
          "simple",
          `---
description: A simple command
---

Hello world`,
        );

        writeCommand(
          "greet",
          `---
description: Command with arguments
args:
  name:
    default: World
    description: Name to greet
---

Hello $name!

!{echo "greeting"}`,
        );
      });

      it("then loads all markdown commands", () => {
        const result = loadFileCommands(mockPi);

        expect(result).toHaveLength(2);
      });

      it("then extracts command names from filenames", () => {
        const result = loadFileCommands(mockPi);

        expect(result.map((c) => c.name)).toEqual(["greet", "simple"]);
      });

      it("then parses descriptions from frontmatter", () => {
        const result = loadFileCommands(mockPi);

        const simple = result.find((c) => c.name === "simple");
        expect(simple?.description).toBe("A simple command");
      });

      it("then parses args from frontmatter", () => {
        const result = loadFileCommands(mockPi);

        const greet = result.find((c) => c.name === "greet");
        expect(greet?.args?.name).toEqual({
          default: "World",
          description: "Name to greet",
        });
      });

      it("then detects shell commands in template", () => {
        const result = loadFileCommands(mockPi);

        const simple = result.find((c) => c.name === "simple");
        const greet = result.find((c) => c.name === "greet");
        expect(simple?.hasShellCommands).toBe(false);
        expect(greet?.hasShellCommands).toBe(true);
      });

      it("then sorts commands alphabetically", () => {
        const result = loadFileCommands(mockPi);

        expect(result[0].name).toBe("greet");
        expect(result[1].name).toBe("simple");
      });
    });

    describe("given command without description in frontmatter", () => {
      beforeEach(() => {
        writeCommand(
          "nodesc",
          `---
args:
  foo:
    default: bar
---

This is the first line of content.

# Heading

More content.`,
        );
      });

      it("then uses first non-heading line as description", () => {
        const result = loadFileCommands(mockPi);

        expect(result[0].description).toBe(
          "This is the first line of content.",
        );
      });
    });

    describe("given non-markdown files in directory", () => {
      beforeEach(() => {
        const commandsDir = path.join(tempDir, ".pi", "agent", "commands");
        fs.writeFileSync(path.join(commandsDir, "readme.txt"), "ignore me");
        fs.writeFileSync(path.join(commandsDir, "script.sh"), "#!/bin/bash");
      });

      it("then ignores non-markdown files", () => {
        const result = loadFileCommands(mockPi);

        expect(result).toEqual([]);
      });
    });
  });

  describe("evaluateShellCommands", () => {
    const cwd = "/project";

    function createMockPi(
      execImpl: (
        cmd: string,
        args: string[],
      ) => Promise<{ stdout: string; stderr: string }>,
    ): ExtensionAPI {
      return {
        exec: vi.fn(execImpl),
      } as unknown as ExtensionAPI;
    }

    describe("given template without shell commands", () => {
      const template = "Hello world, no commands here.";

      describe("when evaluating", () => {
        it("then returns template unchanged", async () => {
          const mockPi = createMockPi(async () => ({ stdout: "", stderr: "" }));

          const result = await evaluateShellCommands(mockPi, template, cwd);

          expect(result).toBe(template);
          expect(mockPi.exec).not.toHaveBeenCalled();
        });
      });
    });

    describe("given template with single shell command", () => {
      const template = "Current date: !{date +%Y-%m-%d}";

      describe("when command succeeds", () => {
        it("then replaces command with output", async () => {
          const mockPi = createMockPi(async () => ({
            stdout: "2026-02-21\n",
            stderr: "",
          }));

          const result = await evaluateShellCommands(mockPi, template, cwd);

          expect(result).toBe("Current date: 2026-02-21");
          expect(mockPi.exec).toHaveBeenCalledWith(
            "sh",
            ["-c", "date +%Y-%m-%d"],
            {
              cwd,
              timeout: 10000,
            },
          );
        });
      });

      describe("when command fails", () => {
        it("then replaces command with error message", async () => {
          const mockPi = createMockPi(async () => {
            throw new Error("Command not found");
          });

          const result = await evaluateShellCommands(mockPi, template, cwd);

          expect(result).toBe("Current date: [Error: Command not found]");
        });
      });
    });

    describe("given template with multiple shell commands", () => {
      const template = "User: !{whoami}, Host: !{hostname}";

      describe("when all commands succeed", () => {
        it("then replaces all commands with outputs", async () => {
          const mockPi = createMockPi(async (_cmd, args) => {
            const shellCmd = args[1];
            if (shellCmd === "whoami") return { stdout: "alice\n", stderr: "" };
            if (shellCmd === "hostname")
              return { stdout: "myhost\n", stderr: "" };
            return { stdout: "", stderr: "" };
          });

          const result = await evaluateShellCommands(mockPi, template, cwd);

          expect(result).toBe("User: alice, Host: myhost");
        });
      });

      describe("when one command fails", () => {
        it("then replaces failed command with error, others with output", async () => {
          const mockPi = createMockPi(async (_cmd, args) => {
            const shellCmd = args[1];
            if (shellCmd === "whoami") return { stdout: "alice\n", stderr: "" };
            throw new Error("hostname failed");
          });

          const result = await evaluateShellCommands(mockPi, template, cwd);

          expect(result).toBe("User: alice, Host: [Error: hostname failed]");
        });
      });
    });

    describe("given template with command containing pipes", () => {
      const template = "Files: !{ls -la /tmp | head -5}";

      describe("when evaluating", () => {
        it("then passes full command to sh -c", async () => {
          const mockPi = createMockPi(async () => ({
            stdout: "file1\nfile2",
            stderr: "",
          }));

          await evaluateShellCommands(mockPi, template, cwd);

          expect(mockPi.exec).toHaveBeenCalledWith(
            "sh",
            ["-c", "ls -la /tmp | head -5"],
            {
              cwd,
              timeout: 10000,
            },
          );
        });
      });
    });

    describe("given template with command containing redirects", () => {
      const template = "!{echo hello 2>/dev/null}";

      describe("when evaluating", () => {
        it("then passes full command to sh -c", async () => {
          const mockPi = createMockPi(async () => ({
            stdout: "hello",
            stderr: "",
          }));

          await evaluateShellCommands(mockPi, template, cwd);

          expect(mockPi.exec).toHaveBeenCalledWith(
            "sh",
            ["-c", "echo hello 2>/dev/null"],
            {
              cwd,
              timeout: 10000,
            },
          );
        });
      });
    });

    describe("given non-Error exception", () => {
      const template = "!{fail}";

      describe("when evaluating", () => {
        it("then converts to string for error message", async () => {
          const mockPi = createMockPi(async () => {
            throw new Error("string error");
          });

          const result = await evaluateShellCommands(mockPi, template, cwd);

          expect(result).toBe("[Error: string error]");
        });
      });
    });
  });
});
