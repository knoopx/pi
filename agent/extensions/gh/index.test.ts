import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";
import type * as utilsTypes from "./utils";

let spawnResult = { stdout: "", stderr: "", exitCode: 0 };

function createSpawnResult(data: unknown) {
  return {
    stdout: JSON.stringify(data),
    stderr: "",
    exitCode: 0,
  };
}

const repoData = [
  {
    name: "react",
    full_name: "facebook/react",
    description: "A JavaScript library for building UIs",
    html_url: "https://github.com/facebook/react",
    language: "JavaScript",
    stargazers_count: 220000,
    forks_count: 45000,
  },
];

const codeData = [
  {
    repo: "repo",
    owner: "owner",
    name: "index.ts",
    path: "src/index.ts",
    html_url: "https://github.com/owner/repo/blob/main/src/index.ts",
    text_matches: [
      {
        snippet: "function main() {",
        matches: [{ text: "function main" }],
      },
    ],
  },
];

const expectedDetails = {
  query: "react",
  results: repoData,
  total: 1,
};

const errorSpawnResult = {
  stdout: "",
  stderr: "gh: not authenticated",
  exitCode: 1,
};

function getToolByName(mockPi: MockExtensionAPI, name: string): MockTool {
  const found = mockPi.registerTool.mock.calls.find(
    (call) => (call[0] as MockTool).name === name,
  );
  if (!found) throw new Error(`Tool ${name} not found`);
  return found[0] as MockTool;
}

async function executeSearchCode(
  mock: MockExtensionAPI,
  query: string,
): Promise<string[]> {
  const ghCmdJson = (await import("./utils")).ghCmdJson as ReturnType<
    typeof vi.fn
  >;
  ghCmdJson.mockClear();
  const tool = getToolByName(mock, "gh-search-code");
  spawnResult = createSpawnResult(codeData);

  await tool.execute("tool1", { query }, undefined, undefined, {});

  return ghCmdJson.mock.calls[0][0] as string[];
}

vi.mock("./utils", async (importOriginal) => {
  const actual = await importOriginal<typeof utilsTypes>();
  return {
    ...actual,
    ghCmd: vi.fn().mockImplementation((_args: string[]) => {
      return {
        stdout: spawnResult.stdout,
        stderr: spawnResult.stderr,
        exitCode: spawnResult.exitCode,
      };
    }),
    ghCmdJson: vi.fn().mockImplementation(() => {
      if (spawnResult.exitCode !== 0) {
        throw new Error(spawnResult.stderr);
      }
      try {
        return JSON.parse(spawnResult.stdout) as unknown[];
      } catch {
        return [];
      }
    }),
  };
});

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
        (call) => (call[0] as MockTool).name,
      );
      expect(toolNames).toEqual([
        "gh-search-repos",
        "gh-search-code",
        "gh-search-issues",
        "gh-search-prs",
        "gh-repo-contents",
        "gh-file-content",
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

  describe("gh-search-repos", () => {
    it("then it should return formatted repo list", async () => {
      const tool = getToolByName(mockPi, "gh-search-repos");
      spawnResult = createSpawnResult(repoData);

      const result = await tool.execute(
        "tool1",
        { query: "react", limit: 1 },
        undefined,
        undefined,
        {},
      );

      expect((result.content[0] as TextContent).text).toMatchSnapshot();
      expect(result.details).toEqual(expectedDetails);
    });

    it("then it should return error result", async () => {
      const tool = getToolByName(mockPi, "gh-search-repos");
      spawnResult = errorSpawnResult;

      const result = await tool.execute(
        "tool1",
        { query: "react" },
        undefined,
        undefined,
        {},
      );

      expect((result.content[0] as TextContent).text).toBe(
        "Error: gh: not authenticated",
      );
    });
  });

  describe("gh-search-code", () => {
    it("then it should return formatted results", async () => {
      const tool = getToolByName(mockPi, "gh-search-code");
      spawnResult = createSpawnResult(codeData);

      const result = await tool.execute(
        "tool1",
        { query: "function main repo:owner/repo" },
        undefined,
        undefined,
        {},
      );

      expect((result.content[0] as TextContent).text).toMatchSnapshot();
    });

    it("then it should convert repo: qualifier to --repo flag", async () => {
      const callArgs = await executeSearchCode(
        mockPi,
        "wrapGAppsHook4 extension:nix repo:NixOS/nixpkgs",
      );
      expect(callArgs).toContain("--repo=NixOS/nixpkgs");
      expect(callArgs).toContain("--extension=nix");
      const queryArg = callArgs.find(
        (arg: string) =>
          !arg.startsWith("-") && arg !== "search" && arg !== "code",
      );
      expect(queryArg).toBe("wrapGAppsHook4");
    });

    it("then it should convert owner: qualifier to --owner flag", async () => {
      const callArgs = await executeSearchCode(mockPi, "cli owner:microsoft");
      expect(callArgs).toContain("--owner=microsoft");
    });

    it("then it should convert filename: qualifier to --filename flag", async () => {
      const callArgs = await executeSearchCode(
        mockPi,
        "lint filename:package.json",
      );
      expect(callArgs).toContain("--filename=package.json");
    });
  });
});
