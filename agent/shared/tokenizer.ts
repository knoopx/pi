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

/**
 * Tokenize a shell command into pipeline segments, skipping env vars
 * and command wrappers. Each segment is an array of string tokens
 * representing a single command invocation.
 *
 * "FOO=bar env npm install && python3 -m pytest"
 * → [["npm", "install"], ["python3", "-m", "pytest"]]
 */
export function tokenizeCommand(command: string): string[][] {
  const trimmed = command.trim();
  if (!trimmed) return [];

  let tokens: ReturnType<typeof parse>;
  try {
    tokens = parse(trimmed);
  } catch {
    const parts = trimmed.split(/\s+/);
    return parts.length > 0 ? [parts] : [];
  }

  const segments: string[][] = [];
  let current: string[] = [];

  for (const token of tokens) {
    if (typeof token === "object" && token !== null && "op" in token) {
      if (current.length > 0) {
        segments.push(normalizeSegment(current));
        current = [];
      }
    } else if (typeof token === "string") current.push(token);
  }

  if (current.length > 0) segments.push(normalizeSegment(current));

  return segments;
}

/** Strip env vars and command wrappers from the front of a token list. */
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
