import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { errorResult } from "../../shared/result/tool";

// Port of tools.py::_write. Preserves the exact Edit-recipe error string so
// the model recovers to Edit on its next turn. The whitepaper's benchmark
// result depends on Write refusing whole-file rewrites of existing files
// (fires on ~57% of Polyglot exercises).

const WriteParams = Type.Object({
  file_path: Type.String({ description: "Absolute file path" }),
  content: Type.String({ description: "Full file content" }),
});
type WriteParamsType = Static<typeof WriteParams>;

export function countLines(content: string): number {
  if (content.length === 0) return 0;
  const parts = content.split("\n");
  return content.endsWith("\n") ? parts.length - 1 : parts.length;
}

export function buildRefusalRecipe(file_path: string): string {
  return (
    `Error: Write refused — ${file_path} already exists.\n` +
    `\n` +
    `Write is only for creating NEW files. To change an existing file, use Edit:\n` +
    `  {"name": "Edit", "input": {"file_path": "${file_path}", ` +
    `"old_string": "<exact text currently in the file>", ` +
    `"new_string": "<replacement text>"}}\n` +
    `\n` +
    `If you do not already know the file's current content, Read it first to ` +
    `get the exact text for old_string. Include enough surrounding context ` +
    `(2-3 lines) to make old_string unique in the file.\n` +
    `\n` +
    `For multiple changes, emit multiple Edit calls — one per location. Do NOT ` +
    `retry Write; it will be refused again.`
  );
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "write",
    label: "Write",
    description:
      "Create a NEW file with the given content. Refuses if the file already exists — use edit to modify existing files. Parent directories are created automatically.",
    parameters: WriteParams,
    async execute(_toolCallId: string, params: WriteParamsType) {
      const { file_path, content } = params;
      if (existsSync(file_path)) {
        return errorResult(buildRefusalRecipe(file_path));
      }

      try {
        mkdirSync(dirname(file_path), { recursive: true });
        writeFileSync(file_path, content, { encoding: "utf-8" });
        return {
          content: [
            {
              type: "text" as const,
              text: `Created ${file_path} (${countLines(content)} lines)`,
            },
          ],
          details: {},
        };
      } catch (e) {
        return errorResult((e as Error).message);
      }
    },
  });
}
