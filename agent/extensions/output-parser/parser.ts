// Port of local/output_parser.py. Pure-function JSON repair + text-based
// tool-call extraction. Used by the output-parser extension to DETECT
// malformed tool calls (fenced, <tool_call> tags, raw JSON) in assistant
// text. Active repair (executing the extracted calls) is handled by the
// extension via session.followUp() to nudge the model back onto native
// tool-calling for subsequent turns.

function escapeControlChar(ch: string): string | null {
  if (ch === "\n") return "\\n";
  if (ch === "\t") return "\\t";
  if (ch === "\r") return "\\r";
  return null;
}

export function escapeNewlinesInJsonStrings(text: string): string {
  const out: string[] = [];
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && inString && i + 1 < text.length) {
      out.push(ch, text[i + 1]);
      i += 2;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out.push(ch);
    } else {
      const escaped = inString ? escapeControlChar(ch) : null;
      out.push(escaped ?? ch);
    }
    i++;
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

function balanceBrackets(text: string): string {
  const openB =
    (text.match(/\{/g) || []).length - (text.match(/\}/g) || []).length;
  const openS =
    (text.match(/\[/g) || []).length - (text.match(/\]/g) || []).length;
  return text + "}".repeat(Math.max(0, openB)) + "]".repeat(Math.max(0, openS));
}

function normalizeJson(text: string): string {
  let fixed = text;
  fixed = fixed.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
  if (!fixed.includes('"') && fixed.includes("'"))
    fixed = fixed.replace(/'/g, '"');
  if (!fixed.includes('": ') && !fixed.includes('":"')) {
    fixed = fixed.replace(/(?<=[{,\s])(\w+)\s*:/g, '"$1":');
  }
  return balanceBrackets(fixed);
}

export function repairJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  // 0. direct parse
  const direct = tryParse(trimmed);
  if (direct) return direct;

  // 1. re-escape literal newlines/tabs in strings
  let fixed = escapeNewlinesInJsonStrings(trimmed);
  const escaped = tryParse(fixed);
  if (escaped) return escaped;

  fixed = normalizeJson(fixed);
  const normalized = tryParse(fixed);
  if (normalized) return normalized;

  // 6. extract first JSON object
  const m = fixed.match(/\{[^{}]*\}/);
  if (m) {
    const extracted = tryParse(m[0]);
    if (extracted) return extracted;
  }

  return { _raw: raw };
}

export interface ExtractedCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

function addCall(calls: ExtractedCall[], data: Record<string, unknown>): void {
  if (typeof data.name !== "string" || !data.name) return;
  calls.push({
    id: `call_text_${calls.length}`,
    name: data.name,
    input: (data.input ?? data.parameters ?? data.args ?? {}) as Record<
      string,
      unknown
    >,
  });
}

export function parseTextToolCalls(text: string): ExtractedCall[] {
  const calls: ExtractedCall[] = [];
  let m: RegExpExecArray | null;

  // Pattern 1: ```tool ... ``` or ```json ... ```
  const fenceRe = /```(?:tool|json)\s*\n([\s\S]*?)\n```/g;
  while ((m = fenceRe.exec(text))) {
    addCall(calls, repairJson(m[1]));
  }

  // Pattern 2: <tool_call> ... </tool_call>
  const tagRe = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
  while ((m = tagRe.exec(text))) {
    addCall(calls, repairJson(m[1]));
  }

  if (calls.length === 0) {
    const bareRe = /\{[^{}]*"name"\s*:\s*"(\w+)"[^{}]*\}/g;
    while ((m = bareRe.exec(text))) {
      addCall(calls, repairJson(m[0]));
    }
  }

  return calls;
}
