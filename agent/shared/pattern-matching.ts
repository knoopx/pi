import picomatch from "picomatch";
import { tokenizeCommand } from "./tokenizer";

type PatternToken =
  | { kind: "literal"; value: string }
  | { kind: "or"; options: string[][] }
  | { kind: "single" } // ?
  | { kind: "spread" }; // *

/**
 * Match a file path against a glob pattern.
 *
 * Supports standard glob syntax:
 *
 * - `*.ts` matches any .ts file (basename only)
 * - `*.{js,jsx}` matches .js or .jsx files
 * - `{package-lock.json,bun.lockb,yarn.lock}` matches exact basenames
 * - `.jj/*` matches anything under .jj/
 *
 * Patterns without `/` match against the basename only.
 * Patterns with `/` match against the full path.
 */
export function matchFileNamePattern(
  filePath: string,
  pattern: string,
): boolean {
  if (!filePath || !pattern) return false;

  const basename = filePath.split(/[\/\\]/).pop() ?? filePath;

  // If pattern contains a slash, match against the full path.
  // Otherwise match against the basename (standard glob behavior).
  if (pattern.includes("/") || pattern.includes("\\")) {
    return picomatch.isMatch(filePath, pattern, { dot: true });
  }
  return picomatch.isMatch(basename, pattern, { dot: true });
}

/**
 * Match file content against a literal substring pattern.
 *
 * Supports pipe-separated alternatives: `pattern1|pattern2`
 * matches if any single alternative is found as a substring.
 */
export function matchContentPattern(content: string, pattern: string): boolean {
  if (!content || !pattern) return false;

  const alternatives = pattern
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  return alternatives.some((alt) => content.includes(alt));
}

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
      if (orOptions.length === 1 && orOptions[0].length === 1)
        return { kind: "literal", value: orOptions[0][0] };
      return { kind: "or", options: orOptions };
    }

    return { kind: "literal", value: part };
  });
}

/**
 * Match a token sequence against a parsed pattern using backtracking.
 *
 * Literals match the token basename (so /usr/bin/python matches "python").
 * `?` consumes one token, `*` consumes zero or more (tries shortest first).
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

  if (pat.kind === "single")
    return matchTokens(pattern, tokens, pi + 1, ti + 1);

  const actual = getComparableToken(tokens, ti);

  if (pat.kind === "or")
    return pat.options.some((optionTokens) => {
      if (ti + optionTokens.length > tokens.length) {
        return false;
      }
      for (let j = 0; j < optionTokens.length; j++) {
        const tokenActual = getComparableToken(tokens, ti + j);
        if (!matchLiteralToken(tokenActual, optionTokens[j])) {
          return false;
        }
      }
      return matchTokens(pattern, tokens, pi + 1, ti + optionTokens.length);
    });

  if (!matchLiteralToken(actual, pat.value)) return false;
  return matchTokens(pattern, tokens, pi + 1, ti + 1);
}

function parseOrToken(token: string): string[][] | null {
  if (!token.startsWith("{") || !token.endsWith("}")) return null;

  const body = token.slice(1, -1);

  const options = body
    .split(",")
    .map((option) => option.trim().split(/\s+/).filter(Boolean))
    .filter((tokens) => tokens.length > 0);

  if (options.length === 0) return null;

  return options;
}

function getComparableToken(tokens: string[], tokenIndex: number): string {
  if (tokenIndex === 0)
    return tokens[tokenIndex].split("/").pop() || tokens[tokenIndex];

  return tokens[tokenIndex];
}

function matchLiteralToken(actual: string, expected: string): boolean {
  if (!expected.includes("*")) return actual === expected;

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
