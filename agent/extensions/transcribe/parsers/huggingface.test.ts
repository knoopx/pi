import { describe, expect, it } from "vitest";
import { parser as hfParser } from "./huggingface";

describe("HuggingFace parser", () => {
  describe("matches", () => {
    it.each([
      "https://huggingface.co/openai/whisper-large-v3",
      "https://huggingface.co/datasets/glue",
      "https://huggingface.co/spaces/gradio/scalable-text-classifier",
      "http://huggingface.co/user/model",
      "https://huggingface.co/meta-llama/Llama-2-7b/blob/main/config.json",
      "https://huggingface.co/facebook/bart-large/resolve/main/pytorch_model.bin",
      "https://huggingface.co/user/repo/discussions/42",
      "https://huggingface.co/user/repo/tree/main/src",
    ])("matches %s", (url) => {
      expect(hfParser.matches(url)).toBe(true);
    });

    it.each([
      "https://hf.co/openai/whisper",
      "https://example.com/huggingface/model",
      "https://huggingface.org/user/repo",
    ])("does not match %s", (url) => {
      expect(hfParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(hfParser.matches("https://HUGGINGFACE.CO/user/repo")).toBe(true);
    });
  });

  describe("path types via matches", () => {
    it("matches bare model URL (implicit kind)", () => {
      expect(
        hfParser.matches("https://huggingface.co/openai/whisper-large-v3"),
      ).toBe(true);
    });

    it("matches explicit model path", () => {
      expect(
        hfParser.matches("https://huggingface.co/models/openai/whisper"),
      ).toBe(true);
    });

    it("matches dataset path", () => {
      expect(hfParser.matches("https://huggingface.co/datasets/glue")).toBe(
        true,
      );
    });

    it("matches space path", () => {
      expect(
        hfParser.matches(
          "https://huggingface.co/spaces/gradio/scalable-text-classifier",
        ),
      ).toBe(true);
    });

    it("matches file/blob URL", () => {
      expect(
        hfParser.matches(
          "https://huggingface.co/openai/whisper/blob/main/README.md",
        ),
      ).toBe(true);
    });

    it("matches tree URL with revision", () => {
      expect(
        hfParser.matches("https://huggingface.co/user/repo/tree/v1.0/src"),
      ).toBe(true);
    });

    it("matches discussion URLs", () => {
      expect(
        hfParser.matches(
          "https://huggingface.co/openai/whisper/discussions/42",
        ),
      ).toBe(true);
      expect(
        hfParser.matches("https://huggingface.co/openai/whisper/discussions"),
      ).toBe(true);
    });

    it("matches resolve URL for files", () => {
      expect(
        hfParser.matches(
          "https://huggingface.co/facebook/bart-large/resolve/main/pytorch_model.bin",
        ),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles trailing slashes", () => {
      expect(hfParser.matches("https://huggingface.co/user/repo/")).toBe(true);
    });

    it("handles model URLs with hyphens and dots", () => {
      expect(
        hfParser.matches("https://huggingface.co/meta-llama/Llama-2-7b"),
      ).toBe(true);
    });
  });
});
