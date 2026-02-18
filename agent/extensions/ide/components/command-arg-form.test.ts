import { describe, it, expect, vi, beforeEach } from "vitest";
import { createArgFormComponent } from "./command-arg-form";
import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import type { ArgsSection, CommandPaletteTui } from "./command-palette-types";

function createMockPi(
  execImpl?: (
    cmd: string,
    args: string[],
  ) => Promise<{ stdout: string; stderr: string }>,
): ExtensionAPI {
  return {
    exec: vi.fn(execImpl ?? (async () => ({ stdout: "", stderr: "" }))),
  } as unknown as ExtensionAPI;
}

function createMockTui(): CommandPaletteTui {
  return {
    terminal: { rows: 24 },
    requestRender: vi.fn(),
  };
}

function createMockTheme(): Theme {
  return {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  } as unknown as Theme;
}

describe("command-arg-form", () => {
  let mockPi: ExtensionAPI;
  let mockTui: CommandPaletteTui;
  let mockTheme: Theme;
  let onDone: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPi = createMockPi();
    mockTui = createMockTui();
    mockTheme = createMockTheme();
    onDone = vi.fn();
  });

  describe("createArgFormComponent", () => {
    describe("given args with text input field (no default)", () => {
      const args: ArgsSection = {
        name: {
          description: "Your name",
        },
      };

      describe("when typing characters", () => {
        it("then updates field value", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("h");
          form.handleInput("e");
          form.handleInput("l");
          form.handleInput("l");
          form.handleInput("o");
          form.handleInput("\r"); // enter

          expect(onDone).toHaveBeenCalledWith({ name: "hello" });
        });
      });

      describe("when pressing backspace", () => {
        it("then deletes last character", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("h");
          form.handleInput("i");
          form.handleInput("i");
          form.handleInput("\x7f"); // backspace
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ name: "hi" });
        });
      });

      describe("when pressing escape", () => {
        it("then calls onDone with empty result", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("t");
          form.handleInput("e");
          form.handleInput("s");
          form.handleInput("t");
          form.handleInput("\x1b"); // escape

          expect(onDone).toHaveBeenCalledWith({});
        });
      });

      describe("when requestRender is called", () => {
        it("then triggers on each input", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("a");

          expect(mockTui.requestRender).toHaveBeenCalled();
        });
      });
    });

    describe("given args with default value", () => {
      const args: ArgsSection = {
        branch: {
          default: "main",
          description: "Branch name",
        },
      };

      describe("when submitting without changes", () => {
        it("then returns default value", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("\r"); // enter

          expect(onDone).toHaveBeenCalledWith({ branch: "main" });
        });
      });

      describe("when typing replaces default", () => {
        it("then uses typed value instead of default", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("d");
          form.handleInput("e");
          form.handleInput("v");
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ branch: "dev" });
        });
      });
    });

    describe("given args with static choices", () => {
      const args: ArgsSection = {
        format: {
          choices: ["json", "yaml", "toml"],
          description: "Output format",
        },
      };

      describe("when pressing left arrow", () => {
        it("then cycles to previous choice (wraps)", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          // First choice is "json" by default, left wraps to "toml"
          form.handleInput("\x1b[D"); // left arrow
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ format: "toml" });
        });
      });

      describe("when pressing right arrow", () => {
        it("then cycles to next choice", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("\x1b[C"); // right arrow - moves to "yaml"
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ format: "yaml" });
        });
      });

      describe("when pressing right arrow multiple times", () => {
        it("then wraps around choices", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("\x1b[C"); // yaml
          form.handleInput("\x1b[C"); // toml
          form.handleInput("\x1b[C"); // wraps to json
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ format: "json" });
        });
      });

      describe("when typing characters", () => {
        it("then ignores text input for selector fields", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("x");
          form.handleInput("y");
          form.handleInput("z");
          form.handleInput("\r");

          // Should still have the default choice "json"
          expect(onDone).toHaveBeenCalledWith({ format: "json" });
        });
      });
    });

    describe("given multiple text fields", () => {
      const args: ArgsSection = {
        from: {
          description: "Starting revision",
        },
        to: {
          description: "Ending revision",
        },
      };

      describe("when pressing down arrow", () => {
        it("then moves to next field", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("a");
          form.handleInput("\x1b[B"); // down arrow
          form.handleInput("b");
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ from: "a", to: "b" });
        });
      });

      describe("when pressing up arrow", () => {
        it("then moves to previous field", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("\x1b[B"); // down to second field
          form.handleInput("x");
          form.handleInput("\x1b[A"); // up to first field
          form.handleInput("y");
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ from: "y", to: "x" });
        });
      });

      describe("when pressing tab", () => {
        it("then moves to next field", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("1");
          form.handleInput("\t"); // tab
          form.handleInput("2");
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ from: "1", to: "2" });
        });
      });

      describe("when on first field and pressing up", () => {
        it("then stays on first field", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("\x1b[A"); // up - should do nothing
          form.handleInput("x");
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ from: "x", to: "" });
        });
      });

      describe("when on last field and pressing down", () => {
        it("then stays on last field", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          form.handleInput("\x1b[B"); // down to second
          form.handleInput("\x1b[B"); // down again - should do nothing
          form.handleInput("z");
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ from: "", to: "z" });
        });
      });
    });

    describe("given mixed fields (text and selector)", () => {
      const args: ArgsSection = {
        project: {
          description: "Project filter",
        },
        format: {
          choices: ["brief", "detailed"],
          description: "Output format",
        },
      };

      describe("when editing text field then selecting choice", () => {
        it("then both values are captured", () => {
          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          // Type in first field (text)
          form.handleInput("m");
          form.handleInput("y");

          // Move to second field (selector)
          form.handleInput("\x1b[B");

          // Select second option
          form.handleInput("\x1b[C");

          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({
            project: "my",
            format: "detailed",
          });
        });
      });
    });

    describe("given dynamic choices from shell command", () => {
      const args: ArgsSection = {
        branch: {
          choices: "git branch --list",
          description: "Git branch",
        },
      };

      describe("when choices load successfully", () => {
        it("then populates selector with results", async () => {
          const mockPiWithBranches = createMockPi(async () => ({
            stdout: "main\nfeature-a\nfeature-b\n",
            stderr: "",
          }));

          const form = createArgFormComponent(
            mockPiWithBranches,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          // Wait for async load with polling
          await new Promise<void>((resolve) => {
            const check = () => {
              if (
                (mockTui.requestRender as ReturnType<typeof vi.fn>).mock.calls
                  .length > 0
              ) {
                resolve();
              } else {
                setTimeout(check, 10);
              }
            };
            setTimeout(check, 10);
          });

          // First choice should be selected by default
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ branch: "main" });
        });
      });

      describe("when cycling through loaded choices", () => {
        it("then navigates options correctly", async () => {
          const mockPiWithBranches = createMockPi(async () => ({
            stdout: "main\nfeature-a\nfeature-b\n",
            stderr: "",
          }));

          const form = createArgFormComponent(
            mockPiWithBranches,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          await new Promise<void>((resolve) => {
            const check = () => {
              if (
                (mockTui.requestRender as ReturnType<typeof vi.fn>).mock.calls
                  .length > 0
              ) {
                resolve();
              } else {
                setTimeout(check, 10);
              }
            };
            setTimeout(check, 10);
          });

          form.handleInput("\x1b[C"); // right - feature-a
          form.handleInput("\x1b[C"); // right - feature-b
          form.handleInput("\r");

          expect(onDone).toHaveBeenCalledWith({ branch: "feature-b" });
        });
      });
    });

    describe("render", () => {
      describe("given single text field", () => {
        const args: ArgsSection = {
          name: { description: "Your name" },
        };

        describe("when rendering", () => {
          it("then includes field label and borders", () => {
            const form = createArgFormComponent(
              mockPi,
              args,
              onDone,
              mockTui,
              mockTheme,
            );

            const lines = form.render(60);

            expect(lines.length).toBeGreaterThan(0);
            expect(lines.some((l) => l.includes("name"))).toBe(true);
          });
        });
      });

      describe("given field with value", () => {
        const args: ArgsSection = {
          branch: { default: "main" },
        };

        describe("when rendering", () => {
          it("then shows value", () => {
            const form = createArgFormComponent(
              mockPi,
              args,
              onDone,
              mockTui,
              mockTheme,
            );

            const lines = form.render(60);

            expect(lines.some((l) => l.includes("main"))).toBe(true);
          });
        });
      });

      describe("given selector field", () => {
        const args: ArgsSection = {
          format: { choices: ["a", "b"] },
        };

        describe("when rendering focused field", () => {
          it("then shows arrow indicators", () => {
            const form = createArgFormComponent(
              mockPi,
              args,
              onDone,
              mockTui,
              mockTheme,
            );

            const lines = form.render(60);

            expect(lines.some((l) => l.includes("←") && l.includes("→"))).toBe(
              true,
            );
          });
        });
      });
    });

    describe("invalidate", () => {
      describe("when called", () => {
        it("then invalidates all input fields without error", () => {
          const args: ArgsSection = {
            field1: {},
            field2: {},
          };

          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          expect(() => form.invalidate()).not.toThrow();
        });
      });
    });

    describe("dispose", () => {
      describe("when called", () => {
        it("then completes without error", () => {
          const args: ArgsSection = {
            field: {},
          };

          const form = createArgFormComponent(
            mockPi,
            args,
            onDone,
            mockTui,
            mockTheme,
          );

          expect(() => form.dispose()).not.toThrow();
        });
      });
    });
  });
});
