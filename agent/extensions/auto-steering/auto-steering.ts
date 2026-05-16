// Port of local/quality.py::assess_response + build_correction_message. Renamed to auto-steering.

export interface ToolCall {
  name: string;
  input: unknown;
}

export type SteeringResult = { ok: true } | { ok: false; reason: string };

function checkToolNames(
  toolCalls: ToolCall[],
  knownTools: Set<string>,
): SteeringResult | null {
  for (const tc of toolCalls) {
    if (!tc.name) return { ok: false, reason: "empty_tool_name" };
    if (knownTools.size > 0 && !knownTools.has(tc.name)) {
      return { ok: false, reason: `unknown_tool:${tc.name}` };
    }
  }
  return null;
}

function checkRepeatedToolCalls(
  text: string,
  toolCalls: ToolCall[],
  recentToolCalls: ToolCall[],
): boolean {
  if (toolCalls.length === 0 || recentToolCalls.length === 0) return false;
  // If the agent wrote explanatory text alongside the repeated call,
  // it's intentional re-verification (e.g., re-running a linter after
  // formatting), not a loop. Only flag when there's no text at all.
  if (text.trim().length > 0) return false;
  for (const tc of toolCalls) {
    for (const prev of recentToolCalls) {
      if (
        tc.name === prev.name &&
        JSON.stringify(tc.input) === JSON.stringify(prev.input)
      ) {
        return true;
      }
    }
  }
  return false;
}

function checkMalformedArgs(toolCalls: ToolCall[]): SteeringResult | null {
  for (const tc of toolCalls) {
    if (tc.input && typeof tc.input === "object" && "_raw" in tc.input) {
      return { ok: false, reason: `malformed_args:${tc.name || "?"}` };
    }
  }
  return null;
}

export function assessResponse(
  text: string,
  toolCalls: ToolCall[],
  recentToolCalls: ToolCall[],
  knownTools: Set<string>,
): SteeringResult {
  if (!text.trim() && toolCalls.length === 0) {
    return { ok: false, reason: "empty_response" };
  }

  const toolNameIssue = checkToolNames(toolCalls, knownTools);
  if (toolNameIssue) return toolNameIssue;

  if (checkRepeatedToolCalls(text, toolCalls, recentToolCalls)) {
    return { ok: false, reason: "repeated_tool_call" };
  }

  const malformed = checkMalformedArgs(toolCalls);
  if (malformed) return malformed;

  return { ok: true };
}

export function buildCorrectionMessage(
  reason: string,
  knownTools: Set<string>,
): string {
  const toolsList =
    knownTools.size > 0
      ? `[${[...knownTools].join(", ")}]`
      : "the available tools";

  const corrections: Record<string, string> = {
    empty_response:
      "Your previous response was empty. Please respond with either " +
      "text or a tool call to make progress on the task.",
    empty_tool_name:
      `Your tool call had an empty name. Please specify a valid tool name. ` +
      `Available tools: ${toolsList}.`,
    repeated_tool_call:
      "You just made the exact same tool call as your previous turn. " +
      "This suggests you may be stuck in a loop. Please try a different " +
      "approach or explain what you're trying to accomplish.",
  };

  if (reason.startsWith("unknown_tool:")) {
    const toolName = reason.slice("unknown_tool:".length);
    return (
      `Tool '${toolName}' does not exist. ` +
      `Available tools: ${toolsList}. Please use one of these.`
    );
  }
  if (reason.startsWith("malformed_args:")) {
    const toolName = reason.slice("malformed_args:".length);
    return (
      `The arguments for tool '${toolName}' were malformed (not valid JSON). ` +
      "Please provide the arguments as a proper JSON object."
    );
  }

  return corrections[reason] ?? `Issue detected: ${reason}. Please try again.`;
}
