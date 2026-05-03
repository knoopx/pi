import type { KeyBinding } from "../../keyboard";
import { Key } from "@mariozechner/pi-tui";
import { buildHelpFromBindings } from "../../keyboard";
import type { ListPickerItem } from "./types";

export function getActionBindings<T extends ListPickerItem>(
  config: { actions?: import("./types").ListPickerAction<T>[] },
  state: { getFilteredItems: () => T[] },
  getFocusedItem: () => T | null,
): KeyBinding[] {
  return (config.actions ?? []).map((action) => ({
    key: action.key as KeyBinding["key"],
    label: action.label,
    when: () => state.getFilteredItems().length > 0,
    handler: async () => {
      const item = getFocusedItem();
      if (item !== null) await action.handler(item);
    },
  }));
}

export function getCoreBindings<T extends ListPickerItem>(
  callbacks: {
    navigate: (dir: "up" | "down" | "pageUp" | "pageDown") => void;
    done: (result: T | null) => void;
    scrollPreview: (dir: "up" | "down") => void;
    onEdit?: (item: T) => Promise<void> | void;
  },
  state: {
    getFilteredItems: () => T[];
    config: { onEdit?: (item: T) => void | Promise<void> };
    getFocusedItem: () => T | null;
  },
): KeyBinding[] {
  return [
    {
      key: "up",
      label: "nav",
      handler: () => {
        callbacks.navigate("up");
      },
    },
    {
      key: "down",
      handler: () => {
        callbacks.navigate("down");
      },
    },
    {
      key: "pageUp",
      label: "scroll",
      handler: () => {
        callbacks.navigate("pageUp");
      },
    },
    {
      key: "pageDown",
      handler: () => {
        callbacks.navigate("pageDown");
      },
    },
    {
      key: "escape",
      handler: () => {
        callbacks.done(null);
      },
    },
    {
      key: Key.ctrl("e"),
      label: "edit",
      when: () => state.config.onEdit !== undefined,
      handler: () => {
        const item = state.getFocusedItem();
        if (item !== null && state.config.onEdit)
          void Promise.resolve(state.config.onEdit(item));
      },
    },
    {
      key: "shift+pageUp",
      handler: () => {
        callbacks.scrollPreview("up");
      },
    },
    {
      key: "shift+pageDown",
      handler: () => {
        callbacks.scrollPreview("down");
      },
    },
  ];
}

export function getHelpText(bindings: KeyBinding[]): string {
  const activeBindings = bindings.filter((b) => {
    if (!b.label) return false;
    if (b.when && !b.when(undefined as never)) return false;
    return true;
  });
  return buildHelpFromBindings(activeBindings);
}
