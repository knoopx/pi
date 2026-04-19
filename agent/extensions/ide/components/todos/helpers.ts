import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import type { AstGrepMatch, TodoItem } from "./types";

const COMMENT_MARKERS = ["TODO", "FIXME", "HACK", "XXX"] as const;

const MARKERS_REGEX = COMMENT_MARKERS.join("|");

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
        `id: todos-${lang}-${kind}\nrule:\n  kind: ${kind}\n  regex: "${MARKERS_REGEX}"\nlanguage: ${lang}`,
      );
    }
  }
  return rules.join("\n---\n");
}

function extractTag(text: string): string {
  for (const tag of COMMENT_MARKERS) {
    if (text.includes(tag)) return tag;
  }
  return "TODO";
}

export function filterTodosByQuery(
  items: TodoItem[],
  query: string,
): TodoItem[] {
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.text.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q),
  );
}

export async function findTodos(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
): Promise<TodoItem[]> {
  const result = await pi.exec(
    "ast-grep",
    ["scan", "--inline-rules", buildInlineRules(), "--json", "."],
    { cwd },
  );

  if (isFailedScan(result)) return [];

  const matches = parseScanResults(result.stdout);
  if (!matches) return [];

  const items: TodoItem[] = matches.flatMap((m) => {
    return todoItemFromMatch(m) ?? [];
  });

  return query ? filterTodosByQuery(items, query) : items;
}

function isFailedScan(result: { code: number; stdout: string }): boolean {
  return result.code !== 0 && !result.stdout.trim();
}

function parseScanResults(stdout: string): AstGrepMatch[] | null {
  try {
    return JSON.parse(stdout) as AstGrepMatch[];
  } catch {
    return null;
  }
}

function todoItemFromMatch(m: AstGrepMatch): TodoItem | null {
  const lines = m.text.split("\n");
  const tagLine = findTagLine(lines);
  if (tagLine === -1) return null;

  const tag = extractTag(lines[tagLine]);
  const text = cleanTodoText(lines[tagLine], tag);
  if (!text) return null;

  const line = m.range.start.line + 1 + tagLine;
  return {
    id: `${m.file}:${String(line)}`,
    label: text,
    path: m.file,
    startLine: line,
    endLine: line,
    text,
    tag,
  };
}

function findTagLine(lines: string[]): number {
  return lines.findIndex((l) => COMMENT_MARKERS.some((t) => l.includes(t)));
}

function cleanTodoText(rawLine: string, tag: string): string {
  return rawLine
    .trim()
    .replace(/^\/\/\/?\s?|^\/\*\*?\s?|\*\/\s*$|^\*\s?|^#\s?/, "")
    .replace(new RegExp(`${tag}:?\\s*`), "")
    .trim();
}

export function formatTodoItem(
  _width: number,
  theme: Theme,
  item: TodoItem,
): string {
  const pathShort = item.path.replace(/^\.\//, "");
  const location = theme.fg("dim", `${pathShort}:${String(item.startLine)}`);
  return `${item.text} ${location}`;
}
