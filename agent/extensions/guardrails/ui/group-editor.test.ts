import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroupEditor } from "./group-editor";
import type { GuardrailsGroup } from "../config";

/**
 * Terminal escape sequences for testing key handling.
 */
const Keys = {
  up: "\x1b[A",
  down: "\x1b[B",
  enter: "\r",
  escape: "\x1b",
};

describe("GroupEditor", () => {
  const createMockTheme = (): any => ({
    label: vi.fn((s: string, _bold: boolean) => s),
    value: vi.fn((s: string, _selected: boolean) => s),
    hint: vi.fn((s: string) => s),
    cursor: "  ",
    description: vi.fn((s: string) => s),
  });

  const sampleGroups: GuardrailsGroup[] = [
    {
      group: "coreutils",
      pattern: "*",
      rules: [
        {
          context: "command",
          pattern: "^find",
          action: "block",
          reason: "use fd",
        },
      ],
    },
    {
      group: "typescript",
      pattern: "tsconfig.json",
      rules: [
        {
          context: "file_content",
          pattern: "@ts-ignore",
          action: "block",
          reason: "no ts-ignore",
        },
      ],
    },
  ];

  describe("Initialization", () => {
    describe("given empty items array", () => {
      it("then creates editor instance", () => {
        const editor = new GroupEditor({
          label: "Test Groups",
          items: [],
          theme: createMockTheme(),
          onSave: vi.fn(),
          onDone: vi.fn(),
        });

        expect(editor).toBeDefined();
      });
    });

    describe("given valid group items", () => {
      it("then creates editor instance with items", () => {
        const editor = new GroupEditor({
          label: "Test Groups",
          items: sampleGroups,
          theme: createMockTheme(),
          onSave: vi.fn(),
          onDone: vi.fn(),
        });

        expect(editor).toBeDefined();
      });
    });

    describe("given maxVisible option", () => {
      it("then uses provided maxVisible value", () => {
        const editor = new GroupEditor({
          label: "Test Groups",
          items: sampleGroups,
          theme: createMockTheme(),
          onSave: vi.fn(),
          onDone: vi.fn(),
          maxVisible: 5,
        });

        expect(editor).toBeDefined();
      });
    });
  });

  describe("Group List Mode Navigation", () => {
    describe("given multiple groups", () => {
      let editor: GroupEditor;

      beforeEach(() => {
        editor = new GroupEditor({
          label: "Test Groups",
          items: sampleGroups,
          theme: createMockTheme(),
          onSave: vi.fn(),
          onDone: vi.fn(),
        });
      });

      describe("when pressing down arrow", () => {
        it("then moves selection down", () => {
          editor.handleInput(Keys.down);

          expect(editor["selectedIndex"]).toBe(1);
        });
      });

      describe("when pressing up arrow", () => {
        it("then moves selection up", () => {
          editor["selectedIndex"] = 1;
          editor.handleInput(Keys.up);

          expect(editor["selectedIndex"]).toBe(0);
        });
      });

      describe("when at first group and pressing up", () => {
        it("then stays at first group", () => {
          editor.handleInput(Keys.up);

          expect(editor["selectedIndex"]).toBe(0);
        });
      });

      describe("when at last group and pressing down", () => {
        it("then stays at last group", () => {
          editor["selectedIndex"] = 1;
          editor.handleInput(Keys.down);

          expect(editor["selectedIndex"]).toBe(1);
        });
      });
    });
  });

  describe("Group Actions", () => {
    describe("given group list mode", () => {
      let editor: GroupEditor;
      let onSave: (items: GuardrailsGroup[]) => void;

      beforeEach(() => {
        onSave = vi.fn();
        editor = new GroupEditor({
          label: "Test Groups",
          items: [...sampleGroups],
          theme: createMockTheme(),
          onSave,
          onDone: vi.fn(),
        });
      });

      describe("when pressing 'a' key", () => {
        it("then switches to add mode", () => {
          editor.handleInput("a");

          expect(editor["mode"]).toBe("add");
        });
      });

      describe("when pressing 'A' key", () => {
        it("then switches to add mode", () => {
          editor.handleInput("A");

          expect(editor["mode"]).toBe("add");
        });
      });

      describe("when pressing enter", () => {
        it("then opens rule editor for selected group", () => {
          editor.handleInput(Keys.enter);

          expect(editor["view"]).toBe("rules");
          expect(editor["ruleEditor"]).toBeDefined();
        });
      });

      describe("when pressing 'p' key", () => {
        it("then switches to edit mode for pattern", () => {
          editor.handleInput("p");

          expect(editor["mode"]).toBe("edit");
          expect((editor as any)["input"].getValue()).toBe("*");
        });
      });

      describe("when pressing 'P' key", () => {
        it("then switches to edit mode for pattern", () => {
          editor.handleInput("P");

          expect(editor["mode"]).toBe("edit");
          expect((editor as any)["input"].getValue()).toBe("*");
        });
      });

      describe("when pressing 'd' key", () => {
        it("then deletes selected group", () => {
          editor.handleInput("d");

          expect(editor["items"]).toHaveLength(1);
          expect(editor["items"][0].group).toBe("typescript");
          expect(onSave).toHaveBeenCalled();
        });
      });

      describe("when pressing 'D' key", () => {
        it("then deletes selected group", () => {
          editor.handleInput("D");

          expect(editor["items"]).toHaveLength(1);
        });
      });

      describe("when pressing escape", () => {
        it("then calls onDone", () => {
          const onDone = vi.fn();
          editor = new GroupEditor({
            label: "Test Groups",
            items: sampleGroups,
            theme: createMockTheme(),
            onSave: vi.fn(),
            onDone,
          });

          editor.handleInput(Keys.escape);

          expect(onDone).toHaveBeenCalled();
        });
      });
    });
  });

  describe("Add Group Mode", () => {
    describe("given add mode active", () => {
      let editor: GroupEditor;
      let onSave: (items: GuardrailsGroup[]) => void;

      beforeEach(() => {
        onSave = vi.fn();
        editor = new GroupEditor({
          label: "Test Groups",
          items: [],
          theme: createMockTheme(),
          onSave,
          onDone: vi.fn(),
        });
        editor.handleInput("a"); // Enter add mode
      });

      describe("when submitting valid pattern", () => {
        it("then adds new group and saves", () => {
          if ((editor as any)["input"]) {
            (editor as any)["input"].setValue("*.js");
            (editor as any)["input"]["onSubmit"]("*.js");
          }

          expect(editor["items"]).toHaveLength(1);
          expect(editor["items"][0]).toEqual({
            group: "*.js",
            pattern: "*.js",
            rules: [],
          });
          expect(editor["mode"]).toBe("list");
          expect(onSave).toHaveBeenCalled();
        });
      });

      describe("when submitting empty pattern", () => {
        it("then cancels without adding", () => {
          if ((editor as any)["input"]) {
            (editor as any)["input"]["onSubmit"]("");
          }

          expect(editor["items"]).toHaveLength(0);
          expect(editor["mode"]).toBe("list");
        });
      });

      describe("when pressing escape", () => {
        it("then cancels add mode", () => {
          if ((editor as any)["input"]) {
            (editor as any)["input"].setValue("*.js");
            (editor as any)["input"]["onEscape"]();
          }

          expect(editor["mode"]).toBe("list");
          expect(editor["items"]).toHaveLength(0);
        });
      });
    });
  });

  describe("Edit Group Mode", () => {
    describe("given edit mode active", () => {
      let editor: GroupEditor;
      let onSave: (items: GuardrailsGroup[]) => void;

      beforeEach(() => {
        onSave = vi.fn();
        editor = new GroupEditor({
          label: "Test Groups",
          items: [...sampleGroups],
          theme: createMockTheme(),
          onSave,
          onDone: vi.fn(),
        });
        editor.handleInput("p"); // Enter edit mode
      });

      describe("when submitting modified pattern", () => {
        it("then updates group pattern and saves", () => {
          if ((editor as any)["input"]) {
            (editor as any)["input"].setValue("*.ts");
            (editor as any)["input"]["onSubmit"]("*.ts");
          }

          expect(editor["items"][0]).toEqual({
            group: "*.ts",
            pattern: "*.ts",
            rules: sampleGroups[0].rules,
          });
          expect(editor["mode"]).toBe("list");
          expect(onSave).toHaveBeenCalled();
        });
      });

      describe("when submitting empty pattern", () => {
        it("then cancels without saving", () => {
          if ((editor as any)["input"]) {
            (editor as any)["input"]["onSubmit"]("");
          }

          expect(editor["items"][0].group).toBe("coreutils");
          expect(editor["mode"]).toBe("list");
        });
      });
    });
  });

  describe("Rule Editor Integration", () => {
    describe("given rule editor active", () => {
      let editor: GroupEditor;
      let onSave: (items: GuardrailsGroup[]) => void;

      beforeEach(() => {
        onSave = vi.fn();
        editor = new GroupEditor({
          label: "Test Groups",
          items: [...sampleGroups],
          theme: createMockTheme(),
          onSave,
          onDone: vi.fn(),
        });
        editor.handleInput(Keys.enter); // Open rule editor
      });

      describe("when rule editor handles input", () => {
        it("then passes input to rule editor", () => {
          const result = editor.handleInput("a");

          expect(result).toBe(true);
          expect(editor["ruleEditor"]).toBeDefined();
        });
      });

      describe("when rule editor saves", () => {
        it("then updates group rules and calls onSave", () => {
          const ruleEditor = editor["ruleEditor"];
          const newRules = [
            {
              context: "command" as const,
              pattern: "^git",
              action: "confirm" as const,
              reason: "version control",
            },
          ];

          // Simulate rule editor saving
          if (ruleEditor && ruleEditor["onSave"]) {
            ruleEditor["onSave"](newRules);
          }

          expect(editor["items"][0].rules).toEqual(newRules);
          expect(onSave).toHaveBeenCalled();
        });
      });

      describe("when rule editor is done", () => {
        it("then returns to group view", () => {
          const ruleEditor = editor["ruleEditor"];

          if (ruleEditor && ruleEditor["onDone"]) {
            ruleEditor["onDone"]();
          }

          expect(editor["view"]).toBe("groups");
          expect(editor["ruleEditor"]).toBeNull();
        });
      });
    });
  });

  describe("Render Group List", () => {
    describe("given group list mode", () => {
      describe("when rendering empty list", () => {
        it("then shows no groups message", () => {
          const editor = new GroupEditor({
            label: "Test Groups",
            items: [],
            theme: createMockTheme(),
            onSave: vi.fn(),
            onDone: vi.fn(),
          });
          const output = editor.render(80);

          expect(output).toContain(" Test Groups");
          expect(output).toContain("  (no groups)");
          expect(output).toContain("  a: add group • Esc: close");
        });
      });

      describe("when rendering groups", () => {
        it("then shows groups with rule counts", () => {
          const editor = new GroupEditor({
            label: "Test Groups",
            items: sampleGroups,
            theme: createMockTheme(),
            onSave: vi.fn(),
            onDone: vi.fn(),
          });
          const output = editor.render(80);

          expect(output).toContain(" Test Groups");
          expect(
            output.some((line) => line.includes("coreutils (1 rules)")),
          ).toBe(true);
          expect(
            output.some((line) => line.includes("typescript (1 rules)")),
          ).toBe(true);
          expect(output).toContain(
            "  ↑/↓: navigate • Enter: edit rules • p: edit pattern • a: add • d: delete • Esc: close",
          );
        });

        it("then highlights selected group", () => {
          const editor = new GroupEditor({
            label: "Test Groups",
            items: sampleGroups,
            theme: createMockTheme(),
            onSave: vi.fn(),
            onDone: vi.fn(),
          });
          const output = editor.render(80);

          const selectedLine = output.find((line) =>
            line.includes("▶ coreutils"),
          );
          expect(selectedLine).toContain("\x1b[7m"); // Reverse video escape sequence
        });
      });
    });
  });

  describe("Render Input Mode", () => {
    it("then shows add form", () => {
      const editor = new GroupEditor({
        label: "Test Groups",
        items: [],
        theme: createMockTheme(),
        onSave: vi.fn(),
        onDone: vi.fn(),
      });
      (editor as any).handleInput("a");
      const output = editor.render(80);

      expect(output).toContain("  New group pattern:");
      expect(output).toContain("  Enter: submit • Esc: cancel");
    });

    it("then shows edit form", () => {
      const editor = new GroupEditor({
        label: "Test Groups",
        items: sampleGroups,
        theme: createMockTheme(),
        onSave: vi.fn(),
        onDone: vi.fn(),
      });
      (editor as any).handleInput("p");
      const output = editor.render(80);

      expect(output).toContain("  Edit group pattern:");
      expect(output).toContain("  Enter: submit • Esc: cancel");
    });
  });

  describe("Render Rule Editor", () => {
    describe("given rule editor active", () => {
      it("then delegates rendering to rule editor", () => {
        const editor = new GroupEditor({
          label: "Test Groups",
          items: sampleGroups,
          theme: createMockTheme(),
          onSave: vi.fn(),
          onDone: vi.fn(),
        });
        editor.handleInput(Keys.enter); // Open rule editor

        const output = editor.render(80);

        // Rule editor should be rendering
        expect(output).toBeDefined();
      });
    });
  });

  describe("Invalidate", () => {
    describe("given rule editor active", () => {
      it("then calls invalidate on rule editor", () => {
        const editor = new GroupEditor({
          label: "Test Groups",
          items: sampleGroups,
          theme: createMockTheme(),
          onSave: vi.fn(),
          onDone: vi.fn(),
        });
        editor.handleInput(Keys.enter); // Open rule editor

        expect(() => editor.invalidate()).not.toThrow();
      });
    });
  });
});
