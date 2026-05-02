import { describe, it, expect } from "vitest";
import { isTextContent } from "./guards";

describe("isTextContent", () => {
  describe("given a valid text content item", () => {
    const validItem = { type: "text", text: "hello" };

    it("then it should return true for a complete item", () => {
      expect(isTextContent(validItem)).toBe(true);
    });

    it("then it should return true for an item without the text field", () => {
      const minimal = { type: "text" };
      expect(isTextContent(minimal)).toBe(true);
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

  describe("given a non-object value", () => {
    it.each([null, undefined, 42, "string", true, []])(
      "then %p should return false",
      (value) => {
        expect(isTextContent(value)).toBe(false);
      },
    );
  });

  describe("given an object without a type field", () => {
    it("then it should return false", () => {
      expect(isTextContent({ text: "hello" })).toBe(false);
    });
  });

  describe("given an object with a non-text type", () => {
    it.each(["image", "audio", "video"] as const)(
      "then type=%s should return false",
      (type) => {
        expect(isTextContent({ type })).toBe(false);
      },
    );
  });

  describe("given an object with a non-string type", () => {
    it.each([123, true, null] as const)(
      "then type=%p should return false",
      (type) => {
        expect(isTextContent({ type })).toBe(false);
      },
    );
  });
});
