import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
  type ListPickerAction,
} from "./list-picker";
import { getChangeIcon } from "./change-utils";
import { applyFocusedStyle } from "./style-utils";
import {
  loadOpLog,
  getOpShow,
  restoreOp,
  undoOp,
  type OpLogEntry,
} from "../jj";

interface OpLogItem extends ListPickerItem, OpLogEntry {
  isCurrent: boolean;
}

export function createOpLogComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: OpLogItem | null) => void,
  cwd: string,
): ListPickerComponent {
  let pickerRef: ListPickerComponent | null = null;
  let notify: (message: string, type?: "info" | "error") => void = () => {};

  const actions: ListPickerAction<OpLogItem>[] = [
    {
      key: "r",
      label: "restore",
      handler: async (item) => {
        if (item.isCurrent) {
          notify("Already at this operation", "info");
          return;
        }
        const result = await restoreOp(pi, cwd, item.opId);
        if (result.success) {
          notify(`Restored to ${item.opId}`, "info");
          await pickerRef?.reload();
        } else {
          notify(`Failed: ${result.error ?? "Unknown error"}`, "error");
        }
      },
    },
    {
      key: "u",
      label: "undo",
      handler: async () => {
        const result = await undoOp(pi, cwd);
        if (result.success) {
          notify("Undone", "info");
          await pickerRef?.reload();
        } else {
          notify(`Failed: ${result.error ?? "Unknown error"}`, "error");
        }
      },
    },
  ];

  const picker = createListPicker<OpLogItem>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    "",
    {
      title: "Op Log",
      actions,
      loadItems: async (_query) => {
        const entries = await loadOpLog(pi, cwd);
        return entries.map((entry, index) => ({
          ...entry,
          id: entry.opId,
          label: entry.description,
          isCurrent: index === 0,
        }));
      },
      filterItems: (items, query) =>
        items.filter(
          (item) =>
            item.opId.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query),
        ),
      formatItem: (item, _width, theme, isFocused) =>
        applyFocusedStyle(
          theme,
          `${getChangeIcon(item.isCurrent, false)} ${theme.fg("dim", item.opId)} ${item.description}`,
          isFocused,
        ),
      loadPreview: (item) => getOpShow(pi, cwd, item.opId),
    },
  );

  pickerRef = picker;
  notify = (message, type) => picker.notify?.(message, type);
  return picker;
}
