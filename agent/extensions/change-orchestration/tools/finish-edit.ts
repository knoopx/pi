import { Type } from "typebox";
import type {
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { finishEdit } from "../lib/state";
import { createNewChange } from "../jj/changes";

const FinishEditParameters = Type.Object({});

export function createFinishEditTool(
  pi: ExtensionAPI,
): ToolDefinition<typeof FinishEditParameters, { finished: string | null }> {
  return {
    name: "finish-edit",
    label: "Finish Edit",
    description:
      "Mark the current edit session as finished. Call this after completing code modifications.",
    promptSnippet: "finish-edit() — finish the current edit",
    parameters: FinishEditParameters,
    execute: async (_toolCallId, _params, _signal, _onUpdate, ctx) => {
      const finished = finishEdit();
      void createNewChange(pi, ctx.cwd).catch(() => {});
      if (!finished) {
        return {
          content: [
            {
              type: "text",
              text: "No current edit to finish.",
            },
          ],
          details: {
            finished: null,
          },
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Finished: "${finished.name}"`,
          },
        ],
        details: {
          finished: finished.name,
        },
      };
    },
  };
}
