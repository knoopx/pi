import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

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

interface SpawnProc {
  stdout: { push(data: string | null): void };
  stderr: { push(data: string | null): void };
  emit(event: string, code?: number): void;
}

function createProc(): SpawnProc {
  const proc = {
    stdout: { push: vi.fn(), on: vi.fn() },
    stderr: { push: vi.fn(), on: vi.fn() },
    emit: vi.fn(),
    on: vi.fn(),
  } as unknown as SpawnProc;

  setTimeout(() => {
    proc.stdout.push(spawnResult.stdout);
    proc.stdout.push(null);
    proc.stderr.push(spawnResult.stderr);
    proc.stderr.push(null);
    (proc as SpawnProc).emit("close", spawnResult.exitCode);
  }, 0);

  return proc;
}

async function getSpawnMock() {
  return { spawn: createProc };
}

function getToolByName(mockPi: MockExtensionAPI, name: string): MockTool {
  return mockPi.registerTool.mock.calls.find(
    (call) => (call[0] as MockTool).name === name,
  )![0] as MockTool;
}

vi.mock("node:child_process", async () => getSpawnMock());

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

      expect(
        stripAnsi((result.content[0] as TextContent).text),
      ).toMatchSnapshot();
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
        "Error: gh search repos failed: gh: not authenticated",
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

      expect(
        stripAnsi((result.content[0] as TextContent).text),
      ).toMatchSnapshot();
    });
  });
});
