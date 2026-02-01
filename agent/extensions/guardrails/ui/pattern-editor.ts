import { Key, matchesKey } from "@mariozechner/pi-tui";
import { BaseEditor } from "./editor-common";
import { FormHandler } from "./form-handler";

export interface PatternItem {
  pattern: string;
  description: string;
}

export interface PatternEditorOptions {
  label: string;
  items: PatternItem[];
  onSave: (items: PatternItem[]) => void;
  onDone: () => void;
  maxVisible?: number;
}

export class PatternEditor extends BaseEditor<PatternItem> {
  private label: string;
  private onSave: (items: PatternItem[]) => void;
  private formHandler: FormHandler;

  constructor(options: PatternEditorOptions) {
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
        name: "description",
        type: "text",
        label: "Description",
        required: false,
      },
    ]);

    this.formHandler.setOnSubmit((values) => this.submitForm(values));
    this.formHandler.setOnCancel(() => this.cancelForm());
  }

  protected getLabel(): string {
    return this.label;
  }

  protected renderItem(item: PatternItem): string {
    return `${item.description} (${item.pattern})`;
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
    this.formHandler.setValue("pattern", item.pattern);
    this.formHandler.setValue("description", item.description);
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
    const description = values.description?.trim() || pattern;

    if (!pattern) {
      this.cancelForm();
      return;
    }

    const item: PatternItem = {
      pattern,
      description,
    };

    if (this.mode === "edit") {
      this.items[this.editIndex] = item;
    } else {
      this.items.push(item);
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
