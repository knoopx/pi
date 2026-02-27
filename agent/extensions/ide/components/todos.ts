/**
 * TODO comment picker component.
 * Uses ast-grep to find comment AST nodes matching TODO/FIXME/HACK/XXX.
 */

import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
} from "./list-picker";
import { loadFilePreviewWithBat } from "./file-preview";
import { applyFocusedStyle } from "./style-utils";

export interface TodoItem extends ListPickerItem {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  tag: string;
}

interface AstGrepMatch {
  file: string;
  text: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

const TAG_PATTERN = "TODO|FIXME|HACK|XXX";

// Tree-sitter comment node kinds vary by language grammar
const LANGUAGE_COMMENT_KINDS: [string, string[]][] = [
  ["typescript", ["comment"]],
  ["javascript", ["comment"]],
  ["python", ["comment"]],
  ["go", ["comment"]],
  ["css", ["comment"]],
  ["rust", ["line_comment", "block_comment"]],
];

function buildInlineRules(): string {
  const rules: string[] = [];
  for (const [lang, kinds] of LANGUAGE_COMMENT_KINDS) {
    for (const kind of kinds) {
      rules.push(
        `id: todos-${lang}-${kind}\nrule:\n  kind: ${kind}\n  regex: "${TAG_PATTERN}"\nlanguage: ${lang}`,
      );
    }
  }
  return rules.join("\n---\n");
}

function extractTag(text: string): string {
  for (const tag of ["FIXME", "HACK", "XXX", "TODO"]) {
    if (text.includes(tag)) return tag;
  }
  return "TODO";
}

async function findTodos(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
): Promise<TodoItem[]> {
  const result = await pi.exec(
    "ast-grep",
    ["scan", "--inline-rules", buildInlineRules(), "--json", "."],
    { cwd },
  );

  if (result.code !== 0 && !result.stdout.trim()) return [];

  let matches: AstGrepMatch[];
  try {
    matches = JSON.parse(result.stdout);
  } catch {
    return [];
  }

  const items: TodoItem[] = matches.flatMap((m) => {
    const lines = m.text.split("\n");
    const tagLine = lines.findIndex((l) =>
      ["TODO", "FIXME", "HACK", "XXX"].some((t) => l.includes(t)),
    );
    if (tagLine === -1) return [];

    const tag = extractTag(lines[tagLine]);
    const text = lines[tagLine]
      .trim()
      .replace(/^\/\/\/?\s?|^\/\*\*?\s?|\*\/\s*$|^\*\s?|^#\s?/, "")
      .replace(new RegExp(`${tag}:?\\s*`), "")
      .trim();
    if (!text) return [];
    const line = m.range.start.line + 1 + tagLine;

    return [
      {
        id: `${m.file}:${String(line)}`,
        label: text,
        path: m.file,
        startLine: line,
        endLine: line,
        text,
        tag,
      },
    ];
  });

  if (query) {
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q),
    );
  }

  return items;
}

function formatTodoItem(
  theme: Theme,
  item: TodoItem,
  isFocused: boolean,
): string {
  const pathShort = item.path.replace(/^\.\//, "");
  const location = theme.fg("dim", `${pathShort}:${String(item.startLine)}`);
  return applyFocusedStyle(theme, `${item.text} ${location}`, isFocused);
}

export function createTodosComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: TodoItem | null) => void,
  initialQuery: string,
  cwd: string,
): ListPickerComponent {
  return createListPicker<TodoItem>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery,
    {
      title: "TODOs",
      loadItems: (query) => findTodos(pi, cwd, query),
      filterItems: (items, query) => {
        const q = query.toLowerCase();
        return items.filter(
          (item) =>
            item.text.toLowerCase().includes(q) ||
            item.path.toLowerCase().includes(q),
        );
      },
      reloadDebounceMs: 300,
      formatItem: (item, _width, theme, isFocused) =>
        formatTodoItem(theme, item, isFocused),
      loadPreview: (item) => loadFilePreviewWithBat(pi, item.path, cwd),
      actions: [
        {
          key: Key.ctrl("i"),
          label: "insert",
          handler: (item) => {
            done(item);
          },
        },
      ],
    },
  );
}
