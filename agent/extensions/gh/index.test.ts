import { describe, it, expect, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { MockExtensionAPI } from "../../shared/testing/test-utils";
import { createMockExtensionAPI } from "../../shared/testing/test-utils";

import setupGhExtension from "./index";

describe("GH Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupGhExtension(mockPi as unknown as ExtensionAPI);
  });

  describe("given the extension is initialized", () => {
    it("then it should register all gh tools", () => {
      const toolNames = mockPi.registerTool.mock.calls.map(
        (call) => (call[0] as { name: string }).name,
      );
      expect(toolNames).toEqual([
        "gh-list-contents",
        "gh-get-file",
        "gh-list-repo-files",
        "gh-list-gists",
        "gh-get-gist",
        "gh-create-gist",
        "gh-update-gist",
        "gh-list-prs",
        "gh-view-pr",
        "gh-create-pr",
        "gh-list-issues",
        "gh-view-issue",
        "gh-create-issue",
        "gh-list-releases",
        "gh-view-release",
        "gh-list-workflows",
        "gh-list-runs",
      ]);
    });
  });
});
