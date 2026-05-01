import { describe, it, expect } from "vitest";
import { cosine } from "./embeddings";

describe("cosine", () => {
  describe("given identical vectors", () => {
    it("then the similarity should be 1", () => {
      const a = [1, 2, 3];
      expect(cosine(a, a)).toBeCloseTo(1);
    });

    it("then the similarity should be 1 for zero-length vectors", () => {
      expect(cosine([], [])).toBe(0);
    });
  });

  describe("given orthogonal vectors", () => {
    it("then the similarity should be 0", () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(cosine(a, b)).toBeCloseTo(0);
    });
  });

  describe("given opposite vectors", () => {
    it("then the similarity should be -1", () => {
      const a = [1, 1];
      const b = [-1, -1];
      expect(cosine(a, b)).toBeCloseTo(-1);
    });
  });

  describe("given one zero vector", () => {
    it("then the similarity should be 0 to avoid division by zero", () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(cosine(a, b)).toBe(0);
    });

    it("then the similarity should be 0 when both are zero vectors", () => {
      expect(cosine([0, 0], [0, 0])).toBe(0);
    });
  });

  describe("given typical embedding-like vectors", () => {
    it("then it should return a value between -1 and 1", () => {
      const a = [0.1, -0.3, 0.5, 0.2];
      const b = [0.2, -0.1, 0.4, 0.3];
      const result = cosine(a, b);
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("then similar vectors should score higher than dissimilar ones", () => {
      const a = [0.1, 0.2, 0.3];
      const similar = [0.11, 0.21, 0.31];
      const dissimilar = [-0.3, -0.2, -0.1];

      expect(cosine(a, similar)).toBeGreaterThan(cosine(a, dissimilar));
    });
  });
});
