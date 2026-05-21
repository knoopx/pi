export type PatternToken =
  | { kind: "literal"; value: string }
  | { kind: "or"; options: string[][] }
  | { kind: "single" }
  | { kind: "spread" };

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

export function parsePattern(pattern: string): PatternToken[] {
  const parts = splitPatternParts(pattern.trim());
  return parts.filter(Boolean).map((part): PatternToken => {
    if (part === "*") return { kind: "spread" };
    if (part === "?") return { kind: "single" };
    const orOptions = parseOrToken(part);
    if (orOptions) {
      if (orOptions.length === 1 && orOptions[0].length === 1)
        return { kind: "literal", value: orOptions[0][0] };
      return { kind: "or", options: orOptions };
    }

    return { kind: "literal", value: part };
  });
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
