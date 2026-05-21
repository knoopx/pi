// Port of local/quality.py::assess_response + build_correction_message.

export interface ToolCall {
  name: string;
  input: unknown;
}

export type SteeringResult = { ok: true } | { ok: false; reason: string };

interface TextContent {
  type: "text";
  text?: string;
}

interface ToolCallContent {
  type: "toolCall";
  name: string;
  arguments?: unknown;
  input?: unknown;
}

type MessageContent = TextContent | ToolCallContent;

export interface TurnEndEvent {
  message?: {
    role?: string;
    stopReason?: string;
    content?: unknown;
  };
}

export interface SteeringState {
  previousToolCalls: ToolCall[];
  consecutiveFailures: number;
}

export const MAX_CONSECUTIVE_CORRECTIONS = 2;

export function createSteeringState(): SteeringState {
  return { previousToolCalls: [], consecutiveFailures: 0 };
}

export function extractContent(raw: unknown): {
  text: string;
  calls: ToolCall[];
} {
  const content = (Array.isArray(raw) ? raw : []) as MessageContent[];
  const text = content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  const calls: ToolCall[] = content
    .filter((c): c is ToolCallContent => c.type === "toolCall")
    .map((c) => ({ name: c.name, input: c.arguments ?? c.input ?? {} }));
  return { text, calls };
}

export function isTerminalMessage(message: TurnEndEvent["message"]): boolean {
  return (
    message?.role === "assistant" &&
    (message.stopReason === "aborted" || message.stopReason === "error")
  );
}

function validateSingleToolName(
  tc: ToolCall,
  knownTools: Set<string>,
): SteeringResult | null {
  if (!tc.name) return { ok: false, reason: "empty_tool_name" };
  if (knownTools.size > 0 && !knownTools.has(tc.name)) {
    return { ok: false, reason: `unknown_tool:${tc.name}` };
  }
  return null;
}

function checkToolNames(
  toolCalls: ToolCall[],
  knownTools: Set<string>,
): SteeringResult | null {
  for (const tc of toolCalls) {
    const result = validateSingleToolName(tc, knownTools);
    if (result) return result;
  }
  return null;
}

function toolCallsMatch(a: ToolCall, b: ToolCall): boolean {
  return (
    a.name === b.name && JSON.stringify(a.input) === JSON.stringify(b.input)
  );
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
  return toolCalls.some((tc) =>
    recentToolCalls.some((prev) => toolCallsMatch(tc, prev)),
  );
}

function isMalformedInput(input: unknown): boolean {
  return !!(input && typeof input === "object" && "_raw" in input);
}

function checkMalformedArgs(toolCalls: ToolCall[]): SteeringResult | null {
  for (const tc of toolCalls) {
    if (isMalformedInput(tc.input)) {
      return { ok: false, reason: `malformed_args:${tc.name || "?"}` };
    }
  }
  return null;
}

function isEmptyResponse(text: string, toolCalls: ToolCall[]): boolean {
  return !text.trim() && toolCalls.length === 0;
}

function checkAllIssues(
  toolCalls: ToolCall[],
  knownTools: Set<string>,
): SteeringResult | null {
  const toolNameIssue = checkToolNames(toolCalls, knownTools);
  if (toolNameIssue) return toolNameIssue;
  const malformed = checkMalformedArgs(toolCalls);
  if (malformed) return malformed;
  return null;
}

export function assessResponse(
  text: string,
  toolCalls: ToolCall[],
  recentToolCalls: ToolCall[],
  knownTools: Set<string>,
): SteeringResult {
  if (isEmptyResponse(text, toolCalls)) {
    return { ok: false, reason: "empty_response" };
  }

  const issue = checkAllIssues(toolCalls, knownTools);
  if (issue) return issue;

  if (checkRepeatedToolCalls(text, toolCalls, recentToolCalls)) {
    return { ok: false, reason: "repeated_tool_call" };
  }

  return { ok: true };
}

function formatToolsList(knownTools: Set<string>): string {
  return knownTools.size > 0
    ? `[${[...knownTools].join(", ")}]`
    : "the available tools";
}

export function buildCorrectionMessage(
  reason: string,
  knownTools: Set<string>,
): string {
  const toolsList = formatToolsList(knownTools);

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
