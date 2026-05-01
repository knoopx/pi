import { parse } from "shell-quote";
const ENV_VAR_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const COMMAND_WRAPPERS = new Set([
  "env",
  "command",
  "exec",
  "nohup",
  "nice",
  "time",
]);

const SEGMENT_SPLITTERS = new Set(["||", "&&", ";"]);

export function tokenizeCommand(command: string): string[][] {
  const trimmed = command.trim();
  if (!trimmed) return [];

  const tokens = parseShell(trimmed);
  const segments: string[][] = [];
  let current: string[] = [];

  for (const token of tokens) {
    processToken(token, current, SEGMENT_SPLITTERS, segments);
  }

  if (current.length > 0) segments.push(normalizeSegment(current));

  return segments;
}

function parseShell(command: string): ReturnType<typeof parse> {
  try {
    return parse(command);
  } catch {
    const parts = command.split(/\s+/);
    return parts.length > 0 ? parts : [];
  }
}

function processToken(
  token: ReturnType<typeof parse>[number],
  current: string[],
  segmentSplitters: Set<string>,
  segments: string[][],
): void {
  if (isOperator(token)) {
    handleOperator(token.op, current, segmentSplitters, segments);
  } else if (typeof token === "string") {
    current.push(token);
  }
}

function isOperator(
  token: ReturnType<typeof parse>[number],
): token is { op: string } {
  return (
    typeof token === "object" &&
    token !== null &&
    "op" in token &&
    typeof (token as { op: unknown }).op === "string"
  );
}

function handleOperator(
  op: string,
  current: string[],
  segmentSplitters: Set<string>,
  segments: string[][],
): void {
  if (segmentSplitters.has(op)) {
    finalizeSegment(current, segments);
  } else {
    current.push(op);
  }
}

function finalizeSegment(current: string[], segments: string[][]): void {
  if (current.length > 0) {
    segments.push(normalizeSegment(current));
    current.length = 0;
  }
}

// Strip env vars and command wrappers from the front of a token list.
function normalizeSegment(tokens: string[]): string[] {
  let i = 0;
  while (i < tokens.length && ENV_VAR_ASSIGNMENT.test(tokens[i])) {
    i++;
  }
  while (i < tokens.length && COMMAND_WRAPPERS.has(tokens[i])) {
    i++;
  }
  return i < tokens.length ? tokens.slice(i) : tokens;
}
