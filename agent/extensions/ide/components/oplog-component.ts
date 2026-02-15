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

interface OpLogEntry extends ListPickerItem {
  opId: string;
  description: string;
  isCurrent: boolean;
}

export function createOpLogComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: OpLogEntry | null) => void,
  cwd: string,
  onNotify?: (message: string, type?: "info" | "error") => void,
): ListPickerComponent {
  let pickerRef: ListPickerComponent | null = null;

  const actions: ListPickerAction<OpLogEntry>[] = [
    {
      key: "r",
      label: "restore",
      handler: async (item) => {
        if (item.isCurrent) {
          onNotify?.("Already at this operation", "info");
          return;
        }
        const result = await pi.exec("jj", ["op", "restore", item.opId], {
          cwd,
        });
        if (result.code === 0) {
          onNotify?.(`Restored to operation ${item.opId}`, "info");
          await pickerRef?.reload();
        } else {
          onNotify?.(`Failed to restore: ${result.stderr}`, "error");
        }
      },
    },
    {
      key: "u",
      label: "undo",
      handler: async () => {
        const result = await pi.exec("jj", ["undo"], { cwd });
        if (result.code === 0) {
          onNotify?.("Undone last operation", "info");
          await pickerRef?.reload();
        } else {
          onNotify?.(`Failed to undo: ${result.stderr}`, "error");
        }
      },
    },
  ];

  const picker = createListPicker<OpLogEntry>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    "",
    {
      title: "Op Log",
      helpParts: ["↑↓ nav", "type to filter"],
      actions,
      loadItems: async () => {
        const result = await pi.exec(
          "jj",
          [
            "op",
            "log",
            "--limit",
            "100",
            "-T",
            'self.id().short() ++ "|" ++ self.description() ++ "\\n"',
            "--no-graph",
          ],
          { cwd },
        );

        if (result.code !== 0) {
          throw new Error(`Failed to load op log: ${result.stderr}`);
        }

        const lines = result.stdout.split("\n").filter((l) => l.trim());
        return lines.map((line, index) => {
          const [opId, ...descParts] = line.split("|");
          const description = descParts.join("|") || "(no description)";
          return {
            id: opId!,
            label: description,
            opId: opId!,
            description,
            isCurrent: index === 0,
          };
        });
      },
      filterItems: (items, query) =>
        items.filter(
          (item) =>
            item.opId.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query),
        ),
      formatItem: (item) => {
        const marker = item.isCurrent ? "@ " : "○ ";
        return `${marker}${item.opId} ${item.description}`;
      },
      loadPreview: async (item) => {
        const result = await pi.exec(
          "jj",
          ["op", "show", "--color=always", item.opId],
          { cwd },
        );
        if (result.code === 0) {
          return result.stdout.split("\n");
        }
        return [`Error: ${result.stderr}`];
      },
    },
  );

  pickerRef = picker;
  return picker;
}
