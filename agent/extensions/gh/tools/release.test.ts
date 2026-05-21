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
import { registerReleaseTools } from "./release";

const TOOL_NAMES = ["gh-list-releases", "gh-view-release"];

describe("registerReleaseTools", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  it("registers both release tool handlers", () => {
    registerAndAssert(mockPi, registerReleaseTools);
    assertHasAllTools(mockPi, TOOL_NAMES);
  });

  it("registers tools with correct labels", () => {
    registerAndAssert(mockPi, registerReleaseTools);
    const labels = mockPi.registerTool.mock.calls.map(
      (call: unknown[]) => (call[0] as { label: string }).label,
    );
    expect(labels).toContain("List Releases");
    expect(labels).toContain("View Release");
  });

  it("registers tools with descriptions", () => {
    registerAndAssert(mockPi, registerReleaseTools);
    assertToolDescriptions(mockPi);
  });

  it("registers tools with parameters", () => {
    registerAndAssert(mockPi, registerReleaseTools);
    assertToolParameters(mockPi);
  });

  it("has render methods for both tools", () => {
    registerAndAssert(mockPi, registerReleaseTools);
    assertRenderMethods(mockPi);
  });
});
