import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
} from "../../lib/list-picker";
import { createFilePreviewLoader } from "../../lib/preview-utils";
import type { TodoItem } from "./types";
import { filterTodosByQuery, findTodos, formatTodoItem } from "./helpers";

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
      loadPreview: createFilePreviewLoader(cwd, theme),
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
