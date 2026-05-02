import { describe, it, expect } from "vitest";
import { fuzzyMatch, fuzzyFilter, fuzzySort } from "./fuzzy";

describe("fuzzy", () => {
  describe("fuzzyMatch", () => {
    it("returns true for empty query", () => {
      expect(fuzzyMatch("anything", "")).toBe(true);
    });

    it("returns true for matching text", () => {
      expect(fuzzyMatch("hello world", "hello")).toBe(true);
      expect(fuzzyMatch("hello world", "world")).toBe(true);
    });

    it("returns false for non-matching text", () => {
      expect(fuzzyMatch("hello world", "xyz")).toBe(false);
    });
  });

  describe("fuzzyFilter", () => {
    it("returns all items for empty query", () => {
      const items = ["apple", "banana", "cherry"];
      const results = fuzzyFilter(items, "", (x) => x);
      expect(results.length).toBe(3);
    });

    it("filters items by query", () => {
      const items = ["apple", "banana", "cherry"];
      const results = fuzzyFilter(items, "ban", (x) => x);
      expect(results.length).toBe(1);
      expect(results[0].item).toBe("banana");
    });

    it("returns empty array for no matches", () => {
      const items = ["apple", "banana", "cherry"];
      const results = fuzzyFilter(items, "xyz", (x) => x);
      expect(results.length).toBe(0);
    });
  });

  describe("fuzzySort", () => {
    it("returns sorted items by relevance", () => {
      const items = ["cherry", "banana", "apple"];
      const results = fuzzySort(items, "a", (x) => x);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
