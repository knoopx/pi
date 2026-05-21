import { describe, it, expect } from "vitest";
import { parseHFUrl } from "./url-parsing";

describe("parseHFUrl", () => {
  it("parses model URL", () => {
    const result = parseHFUrl("https://huggingface.co/meta-llama/Llama-3.1-8B");
    expect(result).toEqual({ kind: "model", owner: "meta-llama", name: "Llama-3.1-8B", type: "repo" });
  });

  it("parses dataset URL as bare path", () => {
    const result = parseHFUrl("https://huggingface.co/datasets/squad");
    expect(result).toEqual({ kind: "model", owner: "datasets", name: "squad", type: "repo" });
  });

  it("parses spaces URL with explicit kind", () => {
    const result = parseHFUrl("https://huggingface.co/spaces/gradio/demo");
    expect(result).toEqual({ kind: "spaces", owner: "gradio", name: "demo", type: "repo" });
  });

  it("parses bare owner/name as model", () => {
    const result = parseHFUrl("https://huggingface.co/openai/whisper");
    expect(result).toEqual({ kind: "model", owner: "openai", name: "whisper", type: "repo" });
  });

  it("parses blob path", () => {
    const result = parseHFUrl("https://huggingface.co/meta-llama/Llama-3.1-8B/blob/main/config.json");
    expect(result).toEqual({ kind: "model", owner: "meta-llama", name: "Llama-3.1-8B", type: "file", revision: "main", path: "config.json" });
  });

  it("parses tree path", () => {
    const result = parseHFUrl("https://huggingface.co/meta-llama/Llama-3.1-8B/tree/v1.0/src");
    expect(result).toEqual({ kind: "model", owner: "meta-llama", name: "Llama-3.1-8B", type: "tree", revision: "v1.0", path: "src" });
  });

  it("parses discussions path", () => {
    const result = parseHFUrl("https://huggingface.co/meta-llama/Llama-3.1-8B/discussions");
    expect(result).toEqual({ kind: "model", owner: "meta-llama", name: "Llama-3.1-8B", type: "discussions" });
  });

  it("parses specific discussion number", () => {
    const result = parseHFUrl("https://huggingface.co/meta-llama/Llama-3.1-8B/discussions/42");
    expect(result).toEqual({ kind: "model", owner: "meta-llama", name: "Llama-3.1-8B", type: "discussion", number: 42 });
  });

  it("returns null for non-huggingface URL", () => {
    expect(parseHFUrl("https://www.example.com/model")).toBeNull();
  });

  it("handles trailing slashes", () => {
    const result = parseHFUrl("https://huggingface.co/openai/whisper///");
    expect(result).toEqual({ kind: "model", owner: "openai", name: "whisper", type: "repo" });
  });

  it("returns null for empty path", () => {
    expect(parseHFUrl("https://huggingface.co/")).toBeNull();
  });
});
