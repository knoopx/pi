
function escapeControlChar(ch: string): string | null {
  if (ch === "\n") return "\\n";
  if (ch === "\t") return "\\t";
  if (ch === "\r") return "\\r";
  return null;
}

function processEscapeChar(
  ch: string,
  nextCh: string | undefined,
): { output: string; skipNext: boolean } {
  if (nextCh !== undefined) {
    return { output: ch + nextCh, skipNext: true };
  }
  return { output: ch, skipNext: false };
}

function processJsonChar(
  ch: string,
  nextCh: string | undefined,
  inString: boolean,
): { output: string; skipNext: boolean; toggledString: boolean } {
  if (ch === "\\" && inString) {
    return { ...processEscapeChar(ch, nextCh), toggledString: false };
  }
  if (ch === '"') {
    return { output: ch, skipNext: false, toggledString: true };
  }
  const output = resolveOutput(ch, inString);
  return { output, skipNext: false, toggledString: false };
}

function resolveOutput(ch: string, inString: boolean): string {
  if (!inString) return ch;
  const escaped = escapeControlChar(ch);
  return escaped ?? ch;
}

export function escapeNewlinesInJsonStrings(text: string): string {
  const out: string[] = [];
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const { output, skipNext, toggledString } = processJsonChar(
      text[i],
      text[i + 1],
      inString,
    );
    if (toggledString) inString = !inString;
    out.push(output);
    i += skipNext ? 2 : 1;
  }
  return out.join("");
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function countChar(text: string, re: RegExp): number {
  let count = 0;
  for (const _ of text.match(re) ?? []) count++;
  return count;
}

function balanceBrackets(text: string): string {
  const openB = countChar(text, /\{/g) - countChar(text, /\}/g);
  const openS = countChar(text, /\[/g) - countChar(text, /\]/g);
  return text + "}".repeat(Math.max(0, openB)) + "]".repeat(Math.max(0, openS));
}

function stripTrailingCommas(text: string): string {
  return text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
}

function normalizeQuotes(text: string): string {
  if (!text.includes('"') && text.includes("'")) {
    return text.replace(/'/g, '"');
  }
  return text;
}

function ensureQuotedKeys(text: string): string {
  if (text.includes('": ') || text.includes('":"')) return text;
  return text.replace(/(?<=[{,\s])(\w+)\s*:/g, '"$1":');
}

function normalizeJson(text: string): string {
  let fixed = stripTrailingCommas(text);
  fixed = normalizeQuotes(fixed);
  fixed = ensureQuotedKeys(fixed);
  return balanceBrackets(fixed);
}

function tryExtractJsonObject(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[^{}]*\}/);
  if (!m) return null;
  return tryParse(m[0]);
}

const repairSteps: ((text: string) => string)[] = [
  (t) => t,
  escapeNewlinesInJsonStrings,
  normalizeJson,
];

export function repairJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  for (const step of repairSteps) {
    const fixed = step(trimmed);
    const parsed = tryParse(fixed);
    if (parsed) return parsed;
  }

  const lastFixed = repairSteps[repairSteps.length - 1](trimmed);
  return tryExtractJsonObject(lastFixed) ?? { _raw: raw };
}

export interface ExtractedCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function resolveCallInput(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return (data.input ?? data.parameters ?? data.args ?? {}) as Record<
    string,
    unknown
  >;
}

function addCall(calls: ExtractedCall[], data: Record<string, unknown>): void {
  if (typeof data.name !== "string" || !data.name) return;
  calls.push({
    id: `call_text_${calls.length}`,
    name: data.name,
    input: resolveCallInput(data),
  });
}

function repairAndAdd(calls: ExtractedCall[], raw: string): void {
  addCall(calls, repairJson(raw));
}

function collectMatches(
  text: string,
  regex: RegExp,
  groupIndex: number,
): string[] {
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    results.push(m[groupIndex]);
  }
  return results;
}

function parseToolCallsFromPattern(
  text: string,
  regex: RegExp,
  groupIndex: number,
): ExtractedCall[] {
  const calls: ExtractedCall[] = [];
  for (const match of collectMatches(text, regex, groupIndex)) {
    repairAndAdd(calls, match);
  }
  return calls;
}

export function parseTextToolCalls(text: string): ExtractedCall[] {
  const fenceCalls = parseToolCallsFromPattern(
    text,
    /```(?:tool|json)\s*\n([\s\S]*?)\n```/g,
    1,
  );
  if (fenceCalls.length > 0) return fenceCalls;

  const tagCalls = parseToolCallsFromPattern(
    text,
    /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g,
    1,
  );
  if (tagCalls.length > 0) return tagCalls;

  return parseToolCallsFromPattern(
    text,
    /\{[^{}]*"name"\s*:\s*"(\w+)"[^{}]*\}/g,
    0,
  );
}
