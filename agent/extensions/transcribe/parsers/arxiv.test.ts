import { describe, expect, it } from "vitest";
import { parser as arxivParser } from "./arxiv";

describe("arXiv parser", () => {
  describe("matches", () => {
    it.each([
      "https://arxiv.org/abs/2101.12345",
      "http://arxiv.org/pdf/2006.12345",
      "https://arxiv.org/html/2505.09388v1",
      "https://arxiv.org/list/cs.AI/recent",
      "https://arxiv.org/search/?searchquery=transformer&searchquery=all:attention",
    ])("matches %s", (url) => {
      expect(arxivParser.matches(url)).toBe(true);
    });

    it.each([
      "https://ar5iv.labs.arxiv.org/html/2101.12345",
      "https://example.com/arxiv/paper",
      "https://notarxiv.org/abs/1234.5678",
    ])("does not match %s", (url) => {
      expect(arxivParser.matches(url)).toBe(false);
    });

    it("is case-insensitive for domain", () => {
      expect(arxivParser.matches("https://ARXIV.ORG/abs/2101.12345")).toBe(
        true,
      );
    });
  });

  describe("path types via matches (proxy test)", () => {
    it("recognizes /abs/<id> URLs", () => {
      expect(arxivParser.matches("https://arxiv.org/abs/2101.12345")).toBe(
        true,
      );
    });

    it("recognizes /pdf/<id> URLs", () => {
      expect(arxivParser.matches("https://arxiv.org/pdf/2006.12345")).toBe(
        true,
      );
    });

    it("recognizes /html/<id> URLs", () => {
      expect(arxivParser.matches("https://arxiv.org/html/2505.09388v1")).toBe(
        true,
      );
      expect(arxivParser.matches("https://arxiv.org/html/2412.15115v2")).toBe(
        true,
      );
    });

    it("recognizes /search/ URLs", () => {
      expect(
        arxivParser.matches(
          "https://arxiv.org/search/?searchquery=quantum+computing",
        ),
      ).toBe(true);
    });

    it("recognizes /list/<category> URLs", () => {
      expect(arxivParser.matches("https://arxiv.org/list/cs.AI/recent")).toBe(
        true,
      );
      expect(arxivParser.matches("https://arxiv.org/list/quant-ph/2024")).toBe(
        true,
      );
    });

    it("recognizes bare domain with path", () => {
      expect(arxivParser.matches("https://arxiv.org/abs/2101.00001")).toBe(
        true,
      );
    });
  });

  describe("edge cases", () => {
    it("handles versioned arXiv IDs", () => {
      expect(arxivParser.matches("https://arxiv.org/abs/2101.12345v3")).toBe(
        true,
      );
    });

    it("handles /list with no count parameter", () => {
      expect(arxivParser.matches("https://arxiv.org/list/cs.CL")).toBe(true);
    });
  });
});
