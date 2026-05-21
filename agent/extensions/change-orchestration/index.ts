import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { containsAbortText } from "../hooks/engine/abort";
import { createBeginEditTool } from "./tools/begin-edit";
import { createFinishEditTool } from "./tools/finish-edit";
import { getCurrentEdit, resetState } from "./lib/state";

/**
 * Edit orchestration extension.
 *
 * Registers two tools: begin-edit, finish-edit.
 * Tracks one active edit at a time.
 *
 * Lifecycle: begin-edit(name) → work → finish-edit() → repeat
 *
 * Hooks:
 * - agent_end: triggers finish-edit protocol
 */
export default function (pi: ExtensionAPI): void {
  pi.registerTool(createBeginEditTool(pi));
  pi.registerTool(createFinishEditTool(pi));
  pi.on("agent_end", (event, _ctx) => handleEndTurn(pi, event, _ctx));
}

function handleEndTurn(
  pi: ExtensionAPI,
  event: AgentEndEvent,
  _ctx: ExtensionContext,
): void {
  if (isAbortedTurn(event.messages)) return;

  const current = getCurrentEdit();
  if (!current) return;

  pi.sendMessage({
    customType: "edit-orchestration",
    content: `Current edit: ${current.name} — call finish-edit() now.`,
    display: true,
  });
}

function isAbortedTurn(messages: AgentEndEvent["messages"]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as {
      role?: string;
      stopReason?: string;
      errorMessage?: string;
    };
    if (msg.role !== "assistant") continue;
    if (msg.stopReason === "aborted") return true;
    if (containsAbortText(msg.errorMessage ?? "")) return true;
  }
  return false;
}

/** Reset state — called between test runs */
export { resetState };
