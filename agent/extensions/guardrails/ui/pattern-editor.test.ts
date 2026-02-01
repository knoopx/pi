import { describe, it, expect, vi } from "vitest";
import { PatternEditor } from "./pattern-editor";
import { EditorTestHelper } from "./test-utils";

const createEditor = (
  items: Array<{ pattern: string; description: string }> = [],
  overrides: Partial<{
    onSave: (items: Array<{ pattern: string; description: string }>) => void;
    onDone: () => void;
    maxVisible: number;
  }> = {},
) => {
  return new PatternEditor({
    label: "Test Patterns",
    items,
    onSave: overrides.onSave ?? vi.fn(),
    onDone: overrides.onDone ?? vi.fn(),
    maxVisible: overrides.maxVisible,
  });
};

const samplePatterns = [
  { pattern: "\\.env$", description: "environment variables" },
  { pattern: "\\.test$", description: "test files" },
];

const testHelper = new EditorTestHelper(createEditor, samplePatterns);

describe("PatternEditor", () => {
  testHelper.testInitialization("Test Patterns");
  testHelper.testListNavigation();
  testHelper.testDelete();
  testHelper.testDoneCallback();

  testHelper.testAddMode(
    (editor) => {
      editor["formHandler"].setValue("pattern", "\\.log$");
      editor["formHandler"].setValue("description", "log files");
    },
    (editor) => {
      // Directly submit the form
      const values = {
        pattern: "\\.log$",
        description: "log files",
      };
      editor["submitForm"](values);
    },
    { pattern: "\\.log$", description: "log files" },
  );

  testHelper.testEditMode(
    (editor) => {
      editor["formHandler"].setValue("pattern", "\\.env\\.backup$");
      editor["formHandler"].setValue("description", "backup environment files");
    },
    (editor) => {
      // Directly submit the form
      const values = {
        pattern: "\\.env\\.backup$",
        description: "backup environment files",
      };
      editor["submitForm"](values);
    },
    { pattern: "\\.env\\.backup$", description: "backup environment files" },
  );

  describe("Form Validation", () => {
    describe("when submitting without pattern", () => {
      it("then cancels without adding", () => {
        const onSave = vi.fn();
        const editor = createEditor([], { onSave });

        // Directly call submitForm with empty pattern
        editor["submitForm"]({
          pattern: "",
          description: "Test description",
        });

        expect(onSave).not.toHaveBeenCalled();
        expect(editor["items"]).toHaveLength(0);
        expect(editor["mode"]).toBe("list");
      });
    });

    describe("when submitting without description", () => {
      it("then uses pattern as description", () => {
        const onSave = vi.fn();
        const editor = createEditor([], { onSave });

        // Directly call submitForm with empty description
        editor["submitForm"]({
          pattern: "\\.tmp$",
          description: "",
        });

        expect(onSave).toHaveBeenCalledWith([
          { pattern: "\\.tmp$", description: "\\.tmp$" },
        ]);
      });
    });
  });

  describe("renderItem", () => {
    it("then renders pattern and description", () => {
      const editor = createEditor([]);
      const result = editor["renderItem"]({
        pattern: "\\.env$",
        description: "environment variables",
      });

      expect(result).toBe("environment variables (\\.env$)");
    });
  });
});
