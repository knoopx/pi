import { describe, it, expect, beforeEach } from "vitest";
import type { MockExtensionAPI } from "../../../shared/testing/test-factories";
import {
  createMockExtensionAPI,
  assertHasAllTools,
  assertToolDescriptions,
  assertToolParameters,
  assertRenderMethods,
  registerAndAssert,
} from "../../../shared/testing/test-factories";
import { registerRepoTools } from "./repo";

const TOOL_NAMES = ["gh-list-contents", "gh-get-file", "gh-list-repo-files"];

describe("registerRepoTools", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  it("registers all repo tool handlers", () => {
    registerAndAssert(mockPi, registerRepoTools);
    assertHasAllTools(mockPi, TOOL_NAMES);
  });

  it("registers tools with correct labels", () => {
    registerAndAssert(mockPi, registerRepoTools);
    const labels = mockPi.registerTool.mock.calls.map(
      (call: unknown[]) => (call[0] as { label: string }).label,
    );
    expect(labels).toContain("Repository Contents");
    expect(labels).toContain("File Content");
    expect(labels).toContain("List Repository Files");
  });

  it("registers tools with descriptions", () => {
    registerAndAssert(mockPi, registerRepoTools);
    assertToolDescriptions(mockPi);
  });

  it("registers tools with parameters", () => {
    registerAndAssert(mockPi, registerRepoTools);
    assertToolParameters(mockPi);
  });

  it("has render methods for all tools", () => {
    registerAndAssert(mockPi, registerRepoTools);
    assertRenderMethods(mockPi);
  });
});
