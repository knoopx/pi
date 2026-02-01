import { Key, matchesKey } from "@mariozechner/pi-tui";
import { BaseEditor } from "./editor-common";
import { FormHandler } from "./form-handler";
import type { GuardrailsRule } from "../config";

export interface RuleEditorOptions {
  label: string;
  items: GuardrailsRule[];
  onSave: (items: GuardrailsRule[]) => void;
  onDone: () => void;
  maxVisible?: number;
}

export class RuleEditor extends BaseEditor<GuardrailsRule> {
  private label: string;
  private onSave: (items: GuardrailsRule[]) => void;
  private formHandler: FormHandler;

  constructor(options: RuleEditorOptions) {
    super(options.items, options.maxVisible ?? 10);
    this.label = options.label;
    this.onSave = options.onSave;
    this.setOnDone(options.onDone);

    this.formHandler = new FormHandler([
      {
        name: "pattern",
        type: "text",
        label: "Pattern (regex)",
        required: true,
      },
      {
        name: "context",
        type: "select",
        label: "Context",
        options: ["command", "file_name", "file_content"],
        defaultValue: 0,
      },
      {
        name: "action",
        type: "select",
        label: "Action",
        options: ["block", "confirm"],
        defaultValue: 0,
      },
      { name: "reason", type: "text", label: "Reason", required: false },
    ]);

    this.formHandler.setOnSubmit((values) => this.submitForm(values));
    this.formHandler.setOnCancel(() => this.cancelForm());
  }

  protected getLabel(): string {
    return this.label;
  }

  protected renderItem(item: GuardrailsRule): string {
    const actionBadge = item.action === "block" ? "[B]" : "[C]";
    return `${actionBadge} ${item.reason}`;
  }

  protected handleItemInput(value: string) {
    this.formHandler.handleInput(value);
  }

  protected handleNavigation(index: number) {
    this.navigate(index);
  }

  protected startEdit(_index: number) {
    if (this.items.length === 0) return;
    const item = this.items[_index];
    if (!item) return;
    this.startEditInternal(_index);

    // Populate form with existing values
    this.formHandler.setValue("pattern", item.pattern);
    this.formHandler.setValue("reason", item.reason);
    this.formHandler.setValue("action", item.action === "block" ? 0 : 1);
    this.formHandler.setValue(
      "context",
      ["command", "file_name", "file_content"].indexOf(item.context),
    );
  }

  protected deleteSelected() {
    this.deleteItem(this.selectedIndex);
    this.onSave([...this.items]);
  }

  protected cancelEdit() {
    // If already in list mode, calling cancelEdit means user wants to close editor
    if (this.mode === "list") {
      if (this.onDone) this.onDone();
      return;
    }
    this.cancelEditInternal();
    this.formHandler.reset();
  }

  protected save() {
    this.onSave([...this.items]);
  }

  private submitForm(values: Record<string, any>) {
    const pattern = values.pattern?.trim();
    const reason = values.reason?.trim() || "No reason provided";

    if (!pattern) {
      this.cancelForm();
      return;
    }

    const rule: GuardrailsRule = {
      context: values.context as "command" | "file_name" | "file_content",
      pattern,
      action: values.action as "block" | "confirm",
      reason,
    };

    if (this.mode === "edit") {
      this.items[this.editIndex] = rule;
    } else {
      this.items.push(rule);
      this.selectedIndex = this.items.length - 1;
    }

    this.save();
    this.cancelForm();
  }

  private cancelForm() {
    this.cancelEdit();
  }

  protected renderInputMode(width: number): string[] {
    return this.formHandler.render(width, this.label, this.mode === "edit");
  }

  invalidate() {}
}
