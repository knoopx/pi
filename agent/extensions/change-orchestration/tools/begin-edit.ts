import { Type } from "typebox";
import type {
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { beginEdit } from "../lib/state";
import { createNewChange } from "../jj/changes";

const BeginEditParameters = Type.Object({
  name: Type.String({
    description:
      "Conventional commit message for this edit. Format: type(scope): description",
  }),
});

export function createBeginEditTool(
  pi: ExtensionAPI,
): ToolDefinition<typeof BeginEditParameters, { started: string }> {
  return {
    name: "begin-edit",
    label: "Begin Edit",
    description:
      "Start a new edit session before modifying code. Accepts a conventional commit message as the edit name.",
    promptSnippet:
      'begin-edit(name="fix(auth): handle null pointer in login flow") — start an edit',
    parameters: BeginEditParameters,
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      beginEdit(params.name);
      void createNewChange(pi, ctx.cwd, params.name).catch(() => {});
      return {
        content: [
          {
            type: "text",
            text: `Started: "${params.name}"`,
          },
        ],
        details: {
          started: params.name,
        },
      };
    },
  };
}
