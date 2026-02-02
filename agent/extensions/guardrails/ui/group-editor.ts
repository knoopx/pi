import { Key, matchesKey } from "@mariozechner/pi-tui";
import { BaseEditor } from "./editor-common";
import { RuleEditor } from "./rule-editor";
import type { GuardrailsGroup, GuardrailsRule } from "../config";
import type { Theme } from "@mariozechner/pi-coding-agent";

export interface GroupEditorOptions {
  label: string;
  items: GuardrailsGroup[];
  theme: Theme;
  onSave: (items: GuardrailsGroup[]) => void;
  onDone: () => void;
  maxVisible?: number;
}

type View = "groups" | "rules";

export class GroupEditor extends BaseEditor<GuardrailsGroup> {
  private label: string;
  private onSave: (items: GuardrailsGroup[]) => void;
  private view: View = "groups";
  private ruleEditor: RuleEditor | null = null;

  constructor(options: GroupEditorOptions) {
    super(options.items, options.maxVisible ?? 10);
    this.label = options.label;
    this.onSave = options.onSave;
    this.setOnDone(options.onDone);
    this.input.onSubmit = (value: string) => {
      if (this.mode === "edit") {
        this.submitEdit(value, this.editIndex);
      } else {
        this.submitAdd(value, this.editIndex);
      }
    };
    this.input.onEscape = () => {
      this.cancelEdit();
    };
  }

  protected getLabel(): string {
    return this.label;
  }

  protected renderItem(item: GuardrailsGroup): string {
    if (!item) {
      return `  (empty)`;
    }
    return `${item.group} (${item.rules.length} rules)`;
  }

  protected handleItemInput(value: string, _index: number) {
    this.input.handleInput(value);
  }

  protected handleNavigation(index: number) {
    this.navigate(index);
  }

  protected startEdit(_index: number) {
    if (this.items.length === 0) return;
    const item = this.items[_index];
    if (!item) return;
    this.startEditInternal(_index);
    this.input.setValue(item.pattern);
  }

  protected deleteSelected() {
    this.deleteItem(this.selectedIndex);
    this.save();
  }

  protected cancelEdit() {
    this.cancelEditInternal();
    this.input.setValue("");
  }

  protected save() {
    this.onSave([...this.items]);
  }

  private submitEdit(value: string, index: number): void {
    const trimmed = value.trim();
    if (!trimmed) {
      this.cancelEdit();
      return;
    }

    if (index >= 0 && index < this.items.length) {
      this.items[index] = {
        ...this.items[index],
        pattern: trimmed,
        group: trimmed,
      };
    }

    this.save();
    this.cancelEdit();
  }

  private submitAdd(value: string, _index: number): void {
    const trimmed = value.trim();
    if (!trimmed) {
      this.cancelEdit();
      return;
    }

    const newGroup = {
      group: trimmed,
      pattern: trimmed,
      rules: [],
    };

    this.items.push(newGroup);
    this.selectedIndex = this.items.length - 1;

    this.save();
    this.cancelEdit();
  }

  private openRuleEditor(groupIndex: number): void {
    const group = this.items[groupIndex];
    if (!group) return;

    this.view = "rules";
    this.ruleEditor = new RuleEditor({
      label: `Rules for "${group.group}"`,
      items: [...group.rules],
      onSave: (rules: GuardrailsRule[]) => {
        this.items[groupIndex] = { ...group, rules };
        this.save();
      },
      onDone: () => {
        this.view = "groups";
        this.ruleEditor = null;
      },
    });
  }

  handleInput(data: string): boolean {
    if (this.view === "rules" && this.ruleEditor) {
      this.ruleEditor.handleInput(data);
      return true;
    }

    if (this.mode === "list") {
      return this.handleGroupListInput(data);
    }

    this.handleItemInput(data, this.editIndex);
    return true;
  }

  private handleGroupListInput(data: string): boolean {
    // Navigation
    if (matchesKey(data, Key.up)) {
      this.navigate(this.selectedIndex - 1);
      return true;
    }
    if (matchesKey(data, Key.down)) {
      this.navigate(this.selectedIndex + 1);
      return true;
    }

    // Enter: open rule editor for selected group
    if (matchesKey(data, Key.enter)) {
      if (this.items.length > 0) {
        this.openRuleEditor(this.selectedIndex);
      }
      return true;
    }

    // 'p': edit pattern/name
    if (data === "p" || data === "P") {
      if (this.items.length > 0) {
        this.startEdit(this.selectedIndex);
      }
      return true;
    }

    // 'a': add new group
    if (data === "a" || data === "A") {
      this.mode = "add";
      this.input.setValue("");
      return true;
    }

    // 'd': delete group
    if (data === "d" || data === "D") {
      if (this.items.length > 0) {
        this.deleteSelected();
      }
      return true;
    }

    // Escape: exit
    if (matchesKey(data, Key.escape)) {
      if (this.onDone) this.onDone();
      return true;
    }

    return false;
  }

  protected renderInputMode(width: number): string[] {
    const lines: string[] = [];
    const isEdit = this.mode === "edit";

    lines.push(isEdit ? "  Edit group pattern:" : "  New group pattern:");
    lines.push("");
    lines.push(`  ${this.input.render(width - 4).join("")}`);
    lines.push("");
    lines.push("  Enter: submit • Esc: cancel");

    return lines;
  }

  protected renderListMode(_width: number): string[] {
    const lines: string[] = [];

    lines.push(` ${this.label}`);
    lines.push("");

    if (this.items.length === 0) {
      lines.push("  (no groups)");
      lines.push("");
      lines.push("  a: add group • Esc: close");
      return lines;
    }

    const start = Math.max(
      0,
      this.selectedIndex - Math.floor(this.maxVisible / 2),
    );
    const end = Math.min(this.items.length, start + this.maxVisible);

    for (let i = start; i < end; i++) {
      const item = this.items[i];
      if (!item) continue;

      const prefix = i === this.selectedIndex ? "▶ " : "  ";
      const rendered = this.renderItem(item);
      const line = `${prefix}${rendered}`;
      lines.push(i === this.selectedIndex ? `\x1b[7m${line}\x1b[27m` : line);
    }

    lines.push("");
    lines.push(
      "  ↑/↓: navigate • Enter: edit rules • p: edit pattern • a: add • d: delete • Esc: close",
    );

    return lines;
  }

  render(width: number): string[] {
    if (this.view === "rules" && this.ruleEditor) {
      return this.ruleEditor.render(width);
    }

    if (this.mode === "list") {
      return this.renderListMode(width);
    }

    return this.renderInputMode(width);
  }

  invalidate(): void {
    if (this.ruleEditor) {
      this.ruleEditor.invalidate();
    }
  }
}
