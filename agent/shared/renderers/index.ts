/**
 * Renderers extension — structured output helpers.
 *
 * Exports:
 *   dotJoin          - join segments with ` • `
 *   sectionDivider   - ─── Label ─────────────────
 *   threadSeparator  - ── author • date ───────────
 *   stateDot         - ● / ○ state indicator
 *   table            - columnar list
 *   detail           - key-value pairs
 *   actionLine       - one-line confirmation
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawnSync } from "node:child_process";

export {
  dotJoin,
  stateDot,
  countLabel,
} from "./header";
export { table, type Column } from "./table";
export { detail } from "./detail";

// ── nu-shell fallback for render-data tool ───────────────

function nuRender(data: unknown, width?: number): string {
  const json = typeof data === "string" ? data : JSON.stringify(data);
  const flags = ["-e"];
  if (width !== undefined) flags.push(`-w ${width}`);

  const result = spawnSync(
    "nu",
    ["-c", `$env.NU_DATA | from json | table ${flags.join(" ")}`.trim()],
    {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NU_DATA: json },
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    throw new Error(
      stderr.length > 0 ? stderr : `nu exited with status ${result.status}`,
    );
  }
  return result.stdout.trimEnd();
}

// ── Extension entry point ────────────────────────────────

export default function renderDataExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "render-data",
    label: "Render Data",
    description:
      "Render structured data (arrays, objects, nested structures) in pi's output.\n\nPass any data and it will be displayed in a readable format.",
    parameters: Type.Object({
      data: Type.Unknown(),
      width: Type.Optional(Type.Number({ minimum: 40, maximum: 500 })),
    }),

    async execute(_toolCallId, params: { data: unknown; width?: number }) {
      const text = nuRender(params.data, params.width);
      return {
        content: [{ type: "text" as const, text }],
        details: {},
      };
    },
  });
}
