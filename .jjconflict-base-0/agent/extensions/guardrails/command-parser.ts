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
    } else if (typeof token === "string") {
      current.push(token);
    }
  }

  if (current.length > 0) {
    segments.push(normalizeSegment(current));
  }

  return segments;
}

/** Strip env vars and command wrappers from the front of a token list. */
function normalizeSegment(tokens: string[]): string[] {
  let i = 0;
  while (i < tokens.length && ENV_VAR_ASSIGNMENT.test(tokens[i])) i++;
  while (i < tokens.length && COMMAND_WRAPPERS.has(tokens[i])) i++;
  return i < tokens.length ? tokens.slice(i) : tokens;
}

// ── Pattern matching ─────────────────────────────────────────────

type PatternToken =
  | { kind: "literal"; value: string }
  | { kind: "or"; options: string[][] }
  | { kind: "single" } // ?
  | { kind: "spread" }; // *

/**
 * Split a pattern string into whitespace-separated parts, treating
 * `{...}` blocks as single tokens even when they contain spaces.
 */
function splitPatternParts(pattern: string): string[] {
  const parts: string[] = [];
  let current = "";
  let braceDepth = 0;

  for (const ch of pattern) {
    if (ch === "{") {
      braceDepth++;
      current += ch;
    } else if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      current += ch;
    } else if (/\s/.test(ch) && braceDepth === 0) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Parse a command pattern string into a list of pattern tokens.
 *
 * Syntax (ast-grep inspired):
 *   - literal tokens match exactly  ("npm", "-rf", "--watch")
 *   - `?`  matches any single token
 *   - `*` matches zero or more tokens (greedy spread)
 *   - `{a,b,c}` matches any one of the listed alternatives
 *   - `{app stop,volume delete}` multi-word alternatives
 *
 * Examples:
 *   "npm *"                        → [literal("npm"), spread]
 *   "{npm,bun} test *"             → [or([["npm"],["bun"]]), literal("test"), spread]
 *   "modal {app stop,volume rm} *" → [literal("modal"), or([["app","stop"],["volume","rm"]]), spread]
 */
export function parsePattern(pattern: string): PatternToken[] {
  const parts = splitPatternParts(pattern.trim());
  return parts.filter(Boolean).map((part): PatternToken => {
    if (part === "*") return { kind: "spread" };
    if (part === "?") return { kind: "single" };

    const orOptions = parseOrToken(part);
    if (orOptions) {
      // A group with a single token option evaluates to that literal
      if (orOptions.length === 1 && orOptions[0].length === 1) {
        return { kind: "literal", value: orOptions[0][0] };
      }
      return { kind: "or", options: orOptions };
    }

    return { kind: "literal", value: part };
  });
}

/**
 * Match a token sequence against a parsed pattern using backtracking.
 *
 * Literals must match the basename of the token (so /usr/bin/python
 * matches the literal "python"). `?` consumes exactly one token.
 * `*` consumes zero or more tokens (tries shortest first).
 */
function matchTokens(
  pattern: PatternToken[],
  tokens: string[],
  pi = 0,
  ti = 0,
): boolean {
  // Both exhausted → match
  if (pi === pattern.length) return ti === tokens.length;

  const pat = pattern[pi];

  if (pat.kind === "spread") {
    // Try consuming 0 .. remaining tokens
    for (let consume = 0; consume <= tokens.length - ti; consume++) {
      if (matchTokens(pattern, tokens, pi + 1, ti + consume)) return true;
    }
    return false;
  }

  // Need at least one token remaining
  if (ti >= tokens.length) return false;

  if (pat.kind === "single") {
    return matchTokens(pattern, tokens, pi + 1, ti + 1);
  }

  const actual = getComparableToken(tokens, ti);

  if (pat.kind === "or") {
    return pat.options.some((optionTokens) => {
      // Check if all tokens in this option match consecutively
      if (ti + optionTokens.length > tokens.length) return false;
      for (let j = 0; j < optionTokens.length; j++) {
        const tokenActual = getComparableToken(tokens, ti + j);
        if (!matchLiteralToken(tokenActual, optionTokens[j])) return false;
      }
      return matchTokens(pattern, tokens, pi + 1, ti + optionTokens.length);
    });
  }

  if (!matchLiteralToken(actual, pat.value)) return false;
  return matchTokens(pattern, tokens, pi + 1, ti + 1);
}

function parseOrToken(token: string): string[][] | null {
  if (!token.startsWith("{") || !token.endsWith("}")) {
    return null;
  }

  const body = token.slice(1, -1);

  const options = body
    .split(",")
    .map((option) => option.trim().split(/\s+/).filter(Boolean))
    .filter((tokens) => tokens.length > 0);

  if (options.length === 0) {
    return null;
  }

  return options;
}

function getComparableToken(tokens: string[], tokenIndex: number): string {
  if (tokenIndex === 0) {
    return tokens[tokenIndex].split("/").pop() || tokens[tokenIndex];
  }

  return tokens[tokenIndex];
}

function matchLiteralToken(actual: string, expected: string): boolean {
  if (!expected.includes("*")) {
    return actual === expected;
  }

  const escaped = expected
    .split("*")
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(actual);
}

/**
 * Test whether a shell command matches a command pattern.
 *
 * The command is parsed into pipeline segments (split on |, &&, ||, ;),
 * with env var prefixes and wrappers stripped. The pattern is matched
 * against each segment — returns true if any segment matches.
 *
 * @example
 * matchCommandPattern("NODE_ENV=prod npm install", "npm *")  // true
 * matchCommandPattern("cd /tmp && jj squash -m 'msg'", "jj squash -m *")  // true
 * matchCommandPattern("bun vitest run", "bun test *")  // false
 */
export function matchCommandPattern(command: string, pattern: string): boolean {
  const patternTokens = parsePattern(pattern);
  if (patternTokens.length === 0) return false;

  const segments = tokenizeCommand(command);
  return segments.some((seg) => matchTokens(patternTokens, seg));
}
