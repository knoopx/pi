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
import { registerWorkflowTools } from "./workflow";

const TOOL_NAMES = ["gh-list-workflows", "gh-list-runs"];

describe("registerWorkflowTools", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  it("registers both workflow tool handlers", () => {
    registerAndAssert(mockPi, registerWorkflowTools);
    assertHasAllTools(mockPi, TOOL_NAMES);
  });

  it("registers tools with correct labels", () => {
    registerAndAssert(mockPi, registerWorkflowTools);
    const labels = mockPi.registerTool.mock.calls.map(
      (call: unknown[]) => (call[0] as { label: string }).label,
    );
    expect(labels).toContain("List Workflows");
    expect(labels).toContain("List Workflow Runs");
  });

  it("registers tools with descriptions", () => {
    registerAndAssert(mockPi, registerWorkflowTools);
    assertToolDescriptions(mockPi);
  });

  it("registers tools with parameters", () => {
    registerAndAssert(mockPi, registerWorkflowTools);
    assertToolParameters(mockPi);
  });

  it("has render methods for all tools", () => {
    registerAndAssert(mockPi, registerWorkflowTools);
    assertRenderMethods(mockPi);
  });
});
