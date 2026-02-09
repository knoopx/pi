import { describe, it, expect } from "vitest";
import { cosineSimilarity, findTopK } from "../embeddings";

describe("cosineSimilarity", () => {
  it("should return 1 for identical vectors", () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it("should return -1 for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it("should return 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("should handle normalized vectors", () => {
    const a = [0.6, 0.8];
    const b = [0.8, 0.6];
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it("should throw for different dimensions", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow();
  });

  it("should return 0 for zero vectors", () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe("findTopK", () => {
  it("should find the most similar embeddings", () => {
    const query = [1, 0, 0];
    const embeddings = [
      [0, 1, 0], // orthogonal
      [1, 0, 0], // identical
      [0.7, 0.7, 0], // somewhat similar
      [-1, 0, 0], // opposite
    ];

    const results = findTopK(query, embeddings, 2);

    expect(results).toHaveLength(2);
    expect(results[0].index).toBe(1); // identical
    expect(results[0].similarity).toBeCloseTo(1, 5);
    expect(results[1].index).toBe(2); // somewhat similar
  });

  it("should return all if k > embeddings.length", () => {
    const query = [1, 0];
    const embeddings = [
      [1, 0],
      [0, 1],
    ];

    const results = findTopK(query, embeddings, 10);

    expect(results).toHaveLength(2);
  });

  it("should return empty for empty embeddings", () => {
    const query = [1, 0];
    const results = findTopK(query, [], 5);
    expect(results).toHaveLength(0);
  });

  it("should sort by similarity descending", () => {
    const query = [1, 0, 0];
    const embeddings = [
      [0.5, 0.5, 0.5],
      [0.9, 0.1, 0],
      [0.3, 0.3, 0.3],
    ];

    const results = findTopK(query, embeddings, 3);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
        results[i].similarity,
      );
    }
  });
});
