import { Input, Key, matchesKey } from "@mariozechner/pi-tui";

/**
 * Common form field types for editors.
 */
export type FormFieldType = "text" | "select";

/**
 * Configuration for a form field.
 */
export interface FormField {
  name: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string | number;
}

/**
 * Common form handling for editor components.
 */
export class FormHandler {
  private fields: FormField[];
  private inputs: Map<string, Input> = new Map();
  private selections: Map<string, number> = new Map();
  private activeFieldIndex: number = 0;
  private onSubmit?: (values: Record<string, any>) => void;
  private onCancel?: () => void;

  constructor(fields: FormField[]) {
    this.fields = fields;

    // Initialize inputs and selections
    fields.forEach((field, _index) => {
      if (field.type === "text") {
        const input = new Input();
        input.onSubmit = () => this.trySubmitOrNext();
        input.onEscape = () => this.onCancel?.();
        this.inputs.set(field.name, input);
      } else if (field.type === "select") {
        this.selections.set(field.name, (field.defaultValue as number) ?? 0);
      }
    });
  }

  /**
   * Set submit callback.
   */
  setOnSubmit(callback: (values: Record<string, any>) => void): void {
    this.onSubmit = callback;
  }

  /**
   * Set cancel callback.
   */
  setOnCancel(callback: () => void): void {
    this.onCancel = callback;
  }

  /**
   * Get current active field.
   */
  getActiveField(): FormField {
    return this.fields[this.activeFieldIndex];
  }

  /**
   * Get value for a field.
   */
  getValue(fieldName: string): string | number {
    const field = this.fields.find((f) => f.name === fieldName);
    if (!field) return "";

    if (field.type === "text") {
      return this.inputs.get(fieldName)?.getValue() ?? "";
    } else if (field.type === "select") {
      const index = this.selections.get(fieldName) ?? 0;
      return field.options?.[index] ?? "";
    }

    return "";
  }

  /**
   * Set value for a field.
   */
  setValue(fieldName: string, value: string | number): void {
    const field = this.fields.find((f) => f.name === fieldName);
    if (!field) return;

    if (field.type === "text") {
      this.inputs.get(fieldName)?.setValue(value as string);
    } else if (field.type === "select" && typeof value === "number") {
      this.selections.set(fieldName, value);
    } else if (field.type === "select" && typeof value === "string") {
      const index = field.options?.indexOf(value) ?? -1;
      if (index >= 0) {
        this.selections.set(fieldName, index);
      }
    }
  }

  /**
   * Handle input in form mode.
   */
  handleInput(data: string): boolean {
    // Field navigation
    if (matchesKey(data, Key.tab) || matchesKey(data, Key.shift("tab"))) {
      this.navigateField(matchesKey(data, Key.shift("tab")));
      return true;
    }

    if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
      return true;
    }

    const activeField = this.getActiveField();

    if (activeField.type === "select") {
      if (
        matchesKey(data, Key.left) ||
        matchesKey(data, Key.right) ||
        data === " "
      ) {
        this.toggleSelection(activeField.name);
        return true;
      }
      if (matchesKey(data, Key.enter)) {
        this.trySubmitOrNext();
        return true;
      }
      return true; // Consume all other input for select fields
    }

    // Delegate to active text input
    const input = this.inputs.get(activeField.name);
    if (input) {
      input.handleInput(data);
      return true;
    }

    return false;
  }

  /**
   * Render form mode.
   */
  render(width: number, title: string, isEdit: boolean): string[] {
    const lines: string[] = [];
    const inputWidth = width - 4;

    lines.push(` ${title} ${isEdit ? "Edit" : "New"}:`);
    lines.push("");

    this.fields.forEach((field, index) => {
      const isActive = index === this.activeFieldIndex;
      const prefix = isActive ? "▶ " : "  ";

      lines.push(`${prefix}${field.label}:`);

      if (field.type === "text") {
        const input = this.inputs.get(field.name);
        if (input) {
          lines.push(`  ${input.render(inputWidth).join("")}`);
        }
      } else if (field.type === "select") {
        const options = field.options ?? [];
        const selectedIndex = this.selections.get(field.name) ?? 0;
        const value = options
          .map((opt, i) => (i === selectedIndex ? `[${opt}]` : ` ${opt} `))
          .join("  ");
        lines.push(`  ${value}`);
      }

      lines.push("");
    });

    lines.push(
      "  Tab: next field · Space/←/→: toggle options · Enter: next/submit · Esc: cancel",
    );

    return lines;
  }

  /**
   * Get form values as object.
   */
  getValues(): Record<string, any> {
    const values: Record<string, any> = {};
    this.fields.forEach((field) => {
      values[field.name] = this.getValue(field.name);
    });
    return values;
  }

  /**
   * Validate form (check required fields).
   */
  validate(): boolean {
    return this.fields.every((field) => {
      if (field.required) {
        const value = this.getValue(field.name);
        return value !== "" && value !== undefined;
      }
      return true;
    });
  }

  /**
   * Reset form to initial state.
   */
  reset(): void {
    this.activeFieldIndex = 0;
    this.fields.forEach((field) => {
      if (field.type === "text") {
        this.inputs.get(field.name)?.setValue("");
      } else if (field.type === "select") {
        this.selections.set(field.name, (field.defaultValue as number) ?? 0);
      }
    });
  }

  private navigateField(backward: boolean = false): void {
    const direction = backward ? -1 : 1;
    this.activeFieldIndex =
      (this.activeFieldIndex + direction + this.fields.length) %
      this.fields.length;
  }

  private toggleSelection(fieldName: string): void {
    const current = this.selections.get(fieldName) ?? 0;
    const field = this.fields.find((f) => f.name === fieldName);
    const maxIndex = (field?.options?.length ?? 1) - 1;
    this.selections.set(fieldName, (current + 1) % (maxIndex + 1));
  }

  private trySubmitOrNext(): void {
    // If current field is required and empty, don't proceed
    const activeField = this.getActiveField();
    if (activeField.required && !this.getValue(activeField.name)) {
      return;
    }

    // If there are more fields, go to next
    if (this.activeFieldIndex < this.fields.length - 1) {
      this.navigateField();
      return;
    }

    // All fields filled, submit
    if (this.validate()) {
      this.onSubmit?.(this.getValues());
    }
  }
}
