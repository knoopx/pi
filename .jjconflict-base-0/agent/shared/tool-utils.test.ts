import { describe, it, expect } from "vitest";
import { textResult, errorResult } from "./tool-utils";

describe("tool-utils", () => {
  describe("textResult", () => {
    it("creates text content with details", () => {
      const result = textResult("hello", { foo: "bar" });
      expect(result.content).toEqual([{ type: "text", text: "hello" }]);
      expect(result.details).toEqual({ foo: "bar" });
    });

    it("uses empty details by default", () => {
      const result = textResult("hello");
      expect(result.details).toEqual({});
    });
  });

  describe("errorResult", () => {
    it("formats Error instances", () => {
      const result = errorResult(new Error("test error"));
      expect(result.content).toEqual([
        { type: "text", text: "Error: test error" },
      ]);
      expect(result.details).toEqual({ error: "test error" });
    });

    it("formats string errors", () => {
      const result = errorResult("string error");
      expect(result.content).toEqual([
        { type: "text", text: "Error: string error" },
      ]);
    });
  });
});
