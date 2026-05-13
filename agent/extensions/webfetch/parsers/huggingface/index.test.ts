import { beforeAll, describe, expect, it } from "vitest";
import { huggingfaceParser } from "./index";
import { parse } from "../../lib/registry";

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
      expect(huggingfaceParser.matches(url)).toBe(true);
    });

    it.each([
      "https://hf.co/openai/whisper",
      "https://example.com/huggingface/model",
      "https://huggingface.org/user/repo",
    ])("does not match %s", (url) => {
      expect(huggingfaceParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(
        huggingfaceParser.matches("https://HUGGINGFACE.CO/user/repo"),
      ).toBe(true);
    });
  });

  describe("path types via matches", () => {
    it("matches bare model URL (implicit kind)", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/openai/whisper-large-v3",
        ),
      ).toBe(true);
    });

    it("matches explicit model path", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/models/openai/whisper",
        ),
      ).toBe(true);
    });

    it("matches dataset path", () => {
      expect(
        huggingfaceParser.matches("https://huggingface.co/datasets/glue"),
      ).toBe(true);
    });

    it("matches space path", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/spaces/gradio/scalable-text-classifier",
        ),
      ).toBe(true);
    });

    it("matches file/blob URL", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/openai/whisper/blob/main/README.md",
        ),
      ).toBe(true);
    });

    it("matches tree URL with revision", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/user/repo/tree/v1.0/src",
        ),
      ).toBe(true);
    });

    it("matches discussion URLs", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/openai/whisper/discussions/42",
        ),
      ).toBe(true);
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/openai/whisper/discussions",
        ),
      ).toBe(true);
    });

    it("matches resolve URL for files", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/facebook/bart-large/resolve/main/pytorch_model.bin",
        ),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles trailing slashes", () => {
      expect(
        huggingfaceParser.matches("https://huggingface.co/user/repo/"),
      ).toBe(true);
    });

    it("handles model URLs with hyphens and dots", () => {
      expect(
        huggingfaceParser.matches(
          "https://huggingface.co/meta-llama/Llama-2-7b",
        ),
      ).toBe(true);
    });
  });

  describe("snapshot", () => {
    beforeAll(async () => {
      const { mockFetchWithFixtures } = await import("../../test/utils");
      mockFetchWithFixtures();
    });
    it("captures output for https://huggingface.co/openai/whisper-large-v3", async () => {
      const result = await parse(
        "https://huggingface.co/openai/whisper-large-v3",
      );
      expect(
        typeof result === "string" ? result : String(result),
      ).toMatchSnapshot();
    });
  });
});
