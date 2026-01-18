import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const groundingTools = [
  "code-stats",
  "code-map",
  "code-query",
  "code-inspect",
  "code-callers",
  "code-callees",
  "code-trace",
  "code-deps",
];

export default function (pi: ExtensionAPI) {
  let groundingDone = false;

  pi.on("session_start", () => {
    groundingDone = false;
  });

  pi.on("tool_result", (event) => {
    if (groundingTools.includes(event.toolName)) {
      groundingDone = true;
    }
  });

  pi.on("tool_call", async (event, _ctx) => {
    if (
      (event.toolName === "edit" || event.toolName === "write") &&
      !groundingDone
    ) {
      return {
        block: true,
        reason: `File editing is blocked until a context-grounding tool (${groundingTools.join(", ")}) has been used. Please gather context first.`,
      };
    }
  });
}
