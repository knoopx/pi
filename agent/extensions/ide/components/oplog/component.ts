import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  createListPicker,
  type ListPickerComponent,
  type ListPickerAction,
} from "../../lib/list-picker";
import { getChangeIcon } from "../../lib/changes-formatting";

import { notifyMutation } from "../../jj/core";
import { loadOpLog, getOpShow, restoreOp, undoOp } from "../../jj/oplog";
import type { OpLogItem } from "./types";

function formatError(error: string | undefined): string {
  return `Failed: ${error ?? "Unknown error"}`;
}

async function getCurrentOpId(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | undefined> {
  const entries = await loadOpLog(pi, cwd);
  return entries[0]?.opId;
}

async function getCurrentAndTargetOpIds(
  pi: ExtensionAPI,
  cwd: string,
): Promise<{ currentOpId?: string; targetOpId?: string }> {
  const entries = await loadOpLog(pi, cwd);
  return {
    currentOpId: entries[0]?.opId,
    targetOpId: entries[1]?.opId,
  };
}

function formatRestoreMessage(
  currentOpId: string | undefined,
  targetOpId: string,
): string {
  if (currentOpId) {
    return `Restored operation ${currentOpId.slice(0, 12)} -> ${targetOpId}`;
  }
  return `Restored operation -> ${targetOpId}`;
}

interface OpLogComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: OpLogItem | null) => void;
  cwd: string;
}

function formatUndoMessage(
  currentOpId: string | undefined,
  targetOpId: string | undefined,
): string {
  if (currentOpId && targetOpId) {
    return `Undid operation ${currentOpId.slice(0, 12)} -> ${targetOpId.slice(0, 12)}`;
  }
  if (currentOpId) {
    return `Undid operation ${currentOpId.slice(0, 12)}`;
  }
  return "Undid operation";
}

function buildOpLogActions(options: {
  pi: ExtensionAPI;
  cwd: string;
  notify: (message: string, type?: "info" | "error") => void;
  pickerRef: { current: ListPickerComponent | null };
}): ListPickerAction<OpLogItem>[] {
  const { pi, cwd, notify, pickerRef } = options;

  return [
    {
      key: "r",
      label: "restore",
      async handler(item) {
        if (item.isCurrent) {
          notify("Already at this operation", "info");
          return;
        }

        const currentOpId = await getCurrentOpId(pi, cwd);
        const result = await restoreOp(pi, cwd, item.opId);

        if (result.success) {
          const targetOpId = item.opId.slice(0, 12);
          const msg = formatRestoreMessage(currentOpId, targetOpId);
          notifyMutation(pi, msg, result.output ?? "");
          await pickerRef.current?.reload();
        } else {
          notify(formatError(result.error), "error");
        }
      },
    },
    {
      key: "u",
      label: "undo",
      async handler() {
        const { currentOpId, targetOpId } = await getCurrentAndTargetOpIds(
          pi,
          cwd,
        );

        const result = await undoOp(pi, cwd);
        if (result.success) {
          const msg = formatUndoMessage(currentOpId, targetOpId);
          notifyMutation(pi, msg, result.output ?? "");
          await pickerRef.current?.reload();
        } else {
          notify(formatError(result.error), "error");
        }
      },
    },
  ];
}

export function createOpLogComponent(
  options: OpLogComponentOptions,
): ListPickerComponent {
  const { pi, tui, theme, keybindings, done, cwd } = options;
  let notify: (message: string, type?: "info" | "error") => void = () => {};
  const pickerRef: { current: ListPickerComponent | null } = { current: null };

  const actions = buildOpLogActions({ pi, cwd, notify, pickerRef });

  const picker = createListPicker<OpLogItem>({
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery: "",
    config: {
      title: "Op Log",
      previewTitle: (item) => item.opId.slice(0, 12),
      actions,
      async loadItems(_query) {
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
      formatItem: (item, width, theme) =>
        `${getChangeIcon(item.isCurrent, false)} ${theme.fg("dim", item.opId)} ${item.description}`,
      loadPreview: (item) => getOpShow(pi, cwd, item.opId),
    },
  });

  pickerRef.current = picker;
  notify = (message, type) => picker.notify?.(message, type);
  return picker;
}
