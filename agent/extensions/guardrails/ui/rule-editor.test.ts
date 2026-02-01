import { describe, it, expect, vi } from "vitest";
import { RuleEditor } from "./rule-editor";
import type { GuardrailsRule } from "../config";
import { EditorTestHelper } from "./test-utils";

const createEditor = (
  items: GuardrailsRule[] = [],
  overrides: Partial<{
    onSave: (items: GuardrailsRule[]) => void;
    onDone: () => void;
    maxVisible: number;
  }> = {},
) => {
  return new RuleEditor({
    label: "Test Rules",
    items,
    onSave: overrides.onSave ?? vi.fn(),
    onDone: overrides.onDone ?? vi.fn(),
    maxVisible: overrides.maxVisible,
  });
};

const sampleRules: GuardrailsRule[] = [
  {
    context: "command",
    pattern: "^rm -rf",
    action: "block",
    reason: "Dangerous deletion",
  },
  {
    context: "command",
    pattern: "^sudo",
    action: "confirm",
    reason: "Privilege escalation",
  },
];

const testHelper = new EditorTestHelper(createEditor, sampleRules);

describe("RuleEditor", () => {
  testHelper.testInitialization("Test Rules");
  testHelper.testListNavigation();
  testHelper.testDelete();
  testHelper.testDoneCallback();

  testHelper.testAddMode(
    (editor) => {
      editor["formHandler"].setValue("pattern", "^test");
      editor["formHandler"].setValue("reason", "Test reason");
    },
    (editor) => {
      // Directly submit the form
      const values = {
        pattern: "^test",
        context: "command",
        action: "block",
        reason: "Test reason",
      };
      editor["submitForm"](values);
    },
    {
      context: "command",
      pattern: "^test",
      action: "block",
      reason: "Test reason",
    },
  );

  testHelper.testEditMode(
    (editor) => {
      editor["formHandler"].setValue("pattern", "^rm -rf /");
      editor["formHandler"].setValue("reason", "Updated reason");
    },
    (editor) => {
      // Directly submit the form
      const values = {
        pattern: "^rm -rf /",
        context: "command",
        action: "block",
        reason: "Updated reason",
      };
      editor["submitForm"](values);
    },
    {
      context: "command",
      pattern: "^rm -rf /",
      action: "block",
      reason: "Updated reason",
    },
  );

  describe("Form Validation", () => {
    describe("when submitting without pattern", () => {
      it("then cancels without adding", () => {
        const onSave = vi.fn();
        const editor = createEditor([], { onSave });

        // Directly call submitForm with empty pattern
        editor["submitForm"]({
          pattern: "",
          context: "command",
          action: "block",
          reason: "Test reason",
        });

        expect(onSave).not.toHaveBeenCalled();
        expect(editor["items"]).toHaveLength(0);
        expect(editor["mode"]).toBe("list");
      });
    });

    describe("when submitting without reason", () => {
      it("then uses default reason", () => {
        const onSave = vi.fn();
        const editor = createEditor([], { onSave });

        // Directly call submitForm with empty reason
        editor["submitForm"]({
          pattern: "^test",
          context: "command",
          action: "block",
          reason: "",
        });

        expect(onSave).toHaveBeenCalledWith([
          {
            context: "command",
            pattern: "^test",
            action: "block",
            reason: "No reason provided",
          },
        ]);
      });
    });
  });

  describe("renderItem", () => {
    describe("given block action rule", () => {
      it("then renders with [B] badge", () => {
        const editor = createEditor([]);
        const result = editor["renderItem"]({
          context: "command",
          pattern: "^test",
          action: "block",
          reason: "Test reason",
        });

        expect(result).toBe("[B] Test reason");
      });
    });

    describe("given confirm action rule", () => {
      it("then renders with [C] badge", () => {
        const editor = createEditor([]);
        const result = editor["renderItem"]({
          context: "command",
          pattern: "^test",
          action: "confirm",
          reason: "Test reason",
        });

        expect(result).toBe("[C] Test reason");
      });
    });
  });
});
