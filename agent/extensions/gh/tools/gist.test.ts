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
import { registerGistTools } from "./gist";

const TOOL_NAMES = [
  "gh-list-gists",
  "gh-get-gist",
  "gh-create-gist",
  "gh-update-gist",
];

describe("registerGistTools", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
  });

  it("registers all four gist tool handlers", () => {
    registerAndAssert(mockPi, registerGistTools);
    assertHasAllTools(mockPi, TOOL_NAMES);
  });

  it("registers tools with correct labels", () => {
    registerAndAssert(mockPi, registerGistTools);
    const labels = mockPi.registerTool.mock.calls.map(
      (call: unknown[]) => (call[0] as { label: string }).label,
    );
    expect(labels).toContain("List Gists");
    expect(labels).toContain("Get Gist");
    expect(labels).toContain("Create Gist");
    expect(labels).toContain("Update Gist");
  });

  it("registers tools with non-empty descriptions", () => {
    registerAndAssert(mockPi, registerGistTools);
    assertToolDescriptions(mockPi);
  });

  it("registers tools with parameters schemas", () => {
    registerAndAssert(mockPi, registerGistTools);
    assertToolParameters(mockPi);
  });

  it("has render methods for all tools", () => {
    registerAndAssert(mockPi, registerGistTools);
    assertRenderMethods(mockPi);
  });
});
