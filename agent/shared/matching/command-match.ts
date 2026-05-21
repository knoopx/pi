import { tokenizeCommand } from "./tokenizer";
import { parsePattern, type PatternToken } from "./command-pattern";

function matchTokens(
  pattern: PatternToken[],
  tokens: string[],
  pi = 0,
  ti = 0,
): boolean {
  if (pi === pattern.length) return ti === tokens.length;
  const pat = pattern[pi];

  if (pat.kind === "spread") {
    for (let consume = 0; consume <= tokens.length - ti; consume++) {
      if (matchTokens(pattern, tokens, pi + 1, ti + consume)) return true;
    }
    return false;
  }

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

export function matchCommandPattern(command: string, pattern: string): boolean {
  const patternTokens = parsePattern(pattern);
  if (patternTokens.length === 0) return false;
  const segments = tokenizeCommand(command);
  return segments.some((seg) => matchTokens(patternTokens, seg));
}
