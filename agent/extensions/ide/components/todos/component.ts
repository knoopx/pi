import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
} from "../../lib/list-picker/picker";
import type { TodoItem } from "./types";
import { filterTodosByQuery, findTodos, formatTodoItem } from "./helpers";
import { loadFilePreviewWithShiki } from "../../lib/file-preview";
import { join } from "node:path";
interface TodosComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: TodoItem | null) => void;
  initialQuery: string;
  cwd: string;
}
export function createTodosComponent(
  options: TodosComponentOptions,
): ListPickerComponent {
  const { pi, tui, theme, keybindings, done, initialQuery, cwd } = options;
  return createListPicker<TodoItem>({
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery,
    config: {
      title: "TODOs",
      loadItems: (query) => findTodos(pi, cwd, query),
      filterItems: (items, query) => filterTodosByQuery(items, query),
      reloadDebounceMs: 300,
      formatItem: (item, width, theme) => formatTodoItem(width, theme, item),
      async loadPreview(item: TodoItem) {
        try {
          const { readFile } = await import("node:fs/promises");
          const content = await readFile(join(cwd, item.path), "utf8");
          return loadFilePreviewWithShiki(item.path, content, theme);
        } catch {
          return [];
        }
      },
      actions: [
        {
          key: Key.ctrl("t"),
          label: "inspect",
          handler(item) {
            done(item);
          },
        },
        {
          key: Key.ctrl("i"),
          label: "insert",
          handler(item) {
            done(item);
          },
        },
      ],
    },
  });
}
