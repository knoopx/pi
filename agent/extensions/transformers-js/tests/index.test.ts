import { describe, it, expect, vi } from "vitest";
import transformersJsExtension from "../index";

describe("transformers-js extension", () => {
  it("should export a function", () => {
    expect(typeof transformersJsExtension).toBe("function");
  });

  it("should register all ML tools", () => {
    const registeredTools: string[] = [];
    const mockPi = {
      registerTool: vi.fn((config: { name: string }) => {
        registeredTools.push(config.name);
      }),
    };

    transformersJsExtension(mockPi as any);

    expect(mockPi.registerTool).toHaveBeenCalled();
    expect(registeredTools).toContain("ml-text-classification");
    expect(registeredTools).toContain("ml-summarize");
    expect(registeredTools).toContain("ml-translate");
    expect(registeredTools).toContain("ml-question-answering");
    expect(registeredTools).toContain("ml-text-generation");
    expect(registeredTools).toContain("ml-ner");
    expect(registeredTools).toContain("ml-zero-shot-classification");
    expect(registeredTools).toContain("ml-fill-mask");
    expect(registeredTools).toContain("ml-object-detection");
  });

  it("should register exactly 9 tools", () => {
    const mockPi = {
      registerTool: vi.fn(),
    };

    transformersJsExtension(mockPi as any);

    expect(mockPi.registerTool).toHaveBeenCalledTimes(9);
  });
});
