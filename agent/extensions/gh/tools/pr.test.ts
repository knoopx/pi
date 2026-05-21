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
import { registerPRTools } from "./pr";

const TOOL_NAMES = ["gh-list-prs", "gh-view-pr", "gh-create-pr"];

describe("registerPRTools", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  it("registers all PR tool handlers", () => {
    registerAndAssert(mockPi, registerPRTools);
    assertHasAllTools(mockPi, TOOL_NAMES);
  });

  it("registers tools with correct labels", () => {
    registerAndAssert(mockPi, registerPRTools);
    const labels = mockPi.registerTool.mock.calls.map(
      (call: unknown[]) => (call[0] as { label: string }).label,
    );
    expect(labels).toContain("PRs");
    expect(labels).toContain("Pull Request");
    expect(labels).toContain("Create Pull Request");
  });

  it("registers tools with descriptions", () => {
    registerAndAssert(mockPi, registerPRTools);
    assertToolDescriptions(mockPi);
  });

  it("registers tools with parameters", () => {
    registerAndAssert(mockPi, registerPRTools);
    assertToolParameters(mockPi);
  });

  it("has render methods for all tools", () => {
    registerAndAssert(mockPi, registerPRTools);
    assertRenderMethods(mockPi);
  });
});
