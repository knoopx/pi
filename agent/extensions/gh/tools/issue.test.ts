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
import { registerIssueTools } from "./issue";

const TOOL_NAMES = ["gh-list-issues", "gh-view-issue", "gh-create-issue"];

describe("registerIssueTools", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  it("registers all issue tool handlers", () => {
    registerAndAssert(mockPi, registerIssueTools);
    assertHasAllTools(mockPi, TOOL_NAMES);
  });

  it("registers tools with correct labels", () => {
    registerAndAssert(mockPi, registerIssueTools);
    const labels = mockPi.registerTool.mock.calls.map(
      (call: unknown[]) => (call[0] as { label: string }).label,
    );
    expect(labels).toContain("Issues");
    expect(labels).toContain("Issue");
    expect(labels).toContain("Create Issue");
  });

  it("registers tools with descriptions", () => {
    registerAndAssert(mockPi, registerIssueTools);
    assertToolDescriptions(mockPi);
  });

  it("registers tools with parameters", () => {
    registerAndAssert(mockPi, registerIssueTools);
    assertToolParameters(mockPi);
  });

  it("has render methods for all tools", () => {
    registerAndAssert(mockPi, registerIssueTools);
    assertRenderMethods(mockPi);
  });
});
