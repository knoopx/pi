import { describe, it, expect } from "vitest";
import { isTextContent } from "./guards";

describe("isTextContent", () => {
  describe("given a valid text content item", () => {
    it("then it should return true when type is text with content", () => {
      expect(isTextContent({ type: "text", text: "hello" })).toBe(true);
    });

    it("then it should return true when type is text without content", () => {
      expect(isTextContent({ type: "text" })).toBe(true);
    });

    it("then it should return true with extra properties present", () => {
      expect(isTextContent({ type: "text", text: "hi", extra: 42 })).toBe(true);
    });
  });

  describe("given a non-text content item", () => {
    it("then it should return false for other types", () => {
      expect(isTextContent({ type: "image", url: "pic.png" })).toBe(false);
    });

    it("then it should return false when type is missing", () => {
      expect(isTextContent({ text: "hello" })).toBe(false);
    });
  });

  describe("given invalid input", () => {
    it("then it should return false for null", () => {
      expect(isTextContent(null)).toBe(false);
    });

    it("then it should return false for undefined", () => {
      expect(isTextContent(undefined)).toBe(false);
    });

    it("then it should return false for primitives", () => {
      expect(isTextContent(42)).toBe(false);
      expect(isTextContent("text")).toBe(false);
      expect(isTextContent(true)).toBe(false);
    });

    it("then it should return false for arrays", () => {
      expect(isTextContent([])).toBe(false);
    });
  });
});
