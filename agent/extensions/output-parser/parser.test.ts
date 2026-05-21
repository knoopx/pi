import { describe, it, expect } from "vitest";
import {
  repairJson,
  parseTextToolCalls,
  escapeNewlinesInJsonStrings,
} from "./lib/parser";

describe("repairJson", () => {
  it("direct parse on valid JSON", () => {
    expect(repairJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("trailing commas", () => {
    expect(repairJson('{"a":1,}')).toEqual({ a: 1 });
    expect(repairJson("[1,2,]")).toEqual([1, 2]);
  });
  it("single quotes", () => {
    expect(repairJson("{'a':1}")).toEqual({ a: 1 });
  });
  it("unquoted keys", () => {
    expect(repairJson("{a:1}")).toEqual({ a: 1 });
  });
  it("missing closing brace", () => {
    expect(repairJson('{"a":1')).toEqual({ a: 1 });
  });
  it("literal newlines in strings", () => {
    const input = '{"text":"line1\nline2"}';
    expect(repairJson(input)).toEqual({ text: "line1\nline2" });
  });
  it("escapeNewlinesInJsonStrings leaves non-string content alone", () => {
    expect(escapeNewlinesInJsonStrings('{"a":1,\n"b":2}')).toBe(
      '{"a":1,\n"b":2}',
    );
  });
  it("escapeNewlinesInJsonStrings handles backslash at end of string", () => {
    expect(escapeNewlinesInJsonStrings('"path\\"')).toBe('"path\\"');
  });
  it("escapeNewlinesInJsonStrings handles backslash at end of quoted string", () => {
    // Backslash inside quotes at end of text → nextCh is undefined
    expect(escapeNewlinesInJsonStrings('{"a":"x\\')).toBe('{"a":"x\\');
  });
  it("escapeNewlinesInJsonStrings escapes tab in string", () => {
    expect(escapeNewlinesInJsonStrings('{"a":"b\tc"}')).toBe('{"a":"b\\tc"}');
  });
  it("escapeNewlinesInJsonStrings escapes carriage return in string", () => {
    expect(escapeNewlinesInJsonStrings('{"a":"b\rc"}')).toBe('{"a":"b\\rc"}');
  });
  it("truncated / garbage returns _raw sentinel", () => {
    const result = repairJson("not json at all");
    expect(result._raw).toBe("not json at all");
  });
  it("repairJson handles braces with unparseable content", () => {
    // Has braces so tryExtractJsonObject returns a match,
    // but the content isn't valid JSON → _raw sentinel
    const result = repairJson("{bad json}");
    expect(result._raw).toBe("{bad json}");
  });
  it("repairJson returns empty object for whitespace input", () => {
    expect(repairJson("   ")).toEqual({});
  });
});

describe("parseTextToolCalls", () => {
  it("extracts fenced ```tool block", () => {
    const text =
      'reasoning first\n```tool\n{"name":"read","input":{"file_path":"/x.py"}}\n```';
    const calls = parseTextToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe("read");
    expect(calls[0].input).toEqual({ file_path: "/x.py" });
  });
  it("extracts ```json block (Gemma pattern)", () => {
    const text = '```json\n{"name":"bash","input":{"command":"ls"}}\n```';
    const calls = parseTextToolCalls(text);
    expect(calls[0].name).toBe("bash");
  });
  it("extracts <tool_call> tag", () => {
    const text =
      '<tool_call>\n{"name":"edit","input":{"path":"/a","edits":[{"oldText":"x","newText":"y"}]}}\n</tool_call>';
    const calls = parseTextToolCalls(text);
    expect(calls[0].name).toBe("edit");
    expect(
      (calls[0].input.edits as Array<{ newText: string }>)?.[0],
    ).toHaveProperty("newText", "y");
  });
  it("extracts multiple fenced calls", () => {
    const text =
      '```tool\n{"name":"read","input":{"file_path":"/a"}}\n```\n' +
      'later\n```tool\n{"name":"read","input":{"file_path":"/b"}}\n```';
    const calls = parseTextToolCalls(text);
    expect(calls.length).toBe(2);
    expect(calls[0].input.file_path).toBe("/a");
    expect(calls[1].input.file_path).toBe("/b");
  });
  it("falls back to bare JSON for flat objects (no nested input)", () => {
    // Bare-JSON regex is restricted to flat objects ([^{}]*), matching
    // the Python implementation — nested "input": {...} won't match.
    const text = 'the model said: {"name":"glob","pattern":"**/*.py"}';
    const calls = parseTextToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].name).toBe("glob");
  });
  it("does not extract from nested-object bare JSON (matches Python behavior)", () => {
    const text =
      'the model said: {"name":"glob","input":{"pattern":"**/*.py"}}';
    const calls = parseTextToolCalls(text);
    // Nested object won't match the flat regex
    expect(calls).toEqual([]);
  });
  it("repairs trailing comma inside fenced block", () => {
    const text = '```tool\n{"name":"read","input":{"file_path":"/x"},}\n```';
    const calls = parseTextToolCalls(text);
    expect(calls[0].name).toBe("read");
  });
  it("accepts parameters/args alias for input", () => {
    const text =
      '```tool\n{"name":"read","parameters":{"file_path":"/x"}}\n```';
    const calls = parseTextToolCalls(text);
    expect(calls[0].input.file_path).toBe("/x");
  });
  it("empty on plain text", () => {
    expect(parseTextToolCalls("just regular text, no tools here")).toEqual([]);
  });
  it("skips non-JSON fenced content (addCall early return)", () => {
    const text = "```tool\nnot json at all\n```";
    const calls = parseTextToolCalls(text);
    // repairJson returns { _raw } which has no name → addCall skips
    expect(calls).toEqual([]);
  });
});
