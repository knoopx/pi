import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

let spawnResult = { stdout: "", stderr: "", exitCode: 0 };

vi.mock("node:child_process", async () => {
  const { EventEmitter } = await import("node:events");
  const { Readable } = await import("node:stream");

  return {
    spawn: () => {
      const proc = new EventEmitter() as InstanceType<typeof EventEmitter> & {
        stdout: InstanceType<typeof Readable>;
        stderr: InstanceType<typeof Readable>;
      };
      const stdoutStream = new Readable({ read() {} });
      const stderrStream = new Readable({ read() {} });
      proc.stdout = stdoutStream;
      proc.stderr = stderrStream;

      setTimeout(() => {
        stdoutStream.push(spawnResult.stdout);
        stdoutStream.push(null);
        stderrStream.push(spawnResult.stderr);
        stderrStream.push(null);
        proc.emit("close", spawnResult.exitCode);
      }, 0);

      return proc;
    },
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
        "gh-list-gists",
        "gh-get-gist",
        "gh-create-gist",
        "gh-delete-gist",
        "gh-update-gist",
        "gh-repo-view",
        "gh-repo-clone",
        "gh-clone-gist",
        "gh-list-repo-files",
        "gh-list-prs",
        "gh-view-pr",
        "gh-create-pr",
        "gh-merge-pr",
        "gh-list-issues",
        "gh-view-issue",
        "gh-create-issue",
        "gh-list-releases",
        "gh-view-release",
        "gh-list-workflows",
        "gh-list-runs",
        "gh-list-labels",
      ]);
    });
  });

  describe("gh-search-repos", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "gh-search-repos",
      )![0] as MockTool;
    });

    describe("given successful search results", () => {
      it("then it should return formatted repo list", async () => {
        spawnResult = {
          stdout: JSON.stringify([
            {
              name: "react",
              full_name: "facebook/react",
              description: "A JavaScript library for building UIs",
              html_url: "https://github.com/facebook/react",
              language: "JavaScript",
              stargazers_count: 220000,
              forks_count: 45000,
            },
          ]),
          stderr: "",
          exitCode: 0,
        };

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
        expect(result.details).toEqual({
          query: "react",
          results: [
            {
              name: "react",
              full_name: "facebook/react",
              description: "A JavaScript library for building UIs",
              html_url: "https://github.com/facebook/react",
              language: "JavaScript",
              stargazers_count: 220000,
              forks_count: 45000,
            },
          ],
          total: 1,
        });
      });
    });

    describe("given gh CLI fails", () => {
      it("then it should return error result", async () => {
        spawnResult = {
          stdout: "",
          stderr: "gh: not authenticated",
          exitCode: 1,
        };

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
  });

  describe("gh-repo-view", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "gh-repo-view",
      )![0] as MockTool;
    });

    describe("given a valid repository", () => {
      it("then it should return formatted repo info", async () => {
        spawnResult = {
          stdout: JSON.stringify({
            name: "react",
            full_name: "facebook/react",
            fullName: "facebook/react",
            description: "A JavaScript library for building UIs",
            html_url: "https://github.com/facebook/react",
            url: "https://github.com/facebook/react",
            language: "JavaScript",
            stargazers_count: 220000,
            stargazersCount: 220000,
            forks_count: 45000,
            forksCount: 45000,
            watchers_count: 220000,
            watchersCount: 220000,
            created_at: "2013-05-24T00:00:00Z",
            createdAt: "2013-05-24T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
            pushed_at: "2025-01-01T00:00:00Z",
            pushedAt: "2025-01-01T00:00:00Z",
            size: 500000,
            default_branch: "main",
            defaultBranchRef: { name: "main" },
            homepage: "https://react.dev",
            homepageUrl: "https://react.dev",
            private: false,
            isPrivate: false,
            fork: false,
            isFork: false,
            owner: {
              login: "facebook",
              id: 69631,
              avatar_url: "",
              html_url: "https://github.com/facebook",
            },
          }),
          stderr: "",
          exitCode: 0,
        };

        const result = await tool.execute(
          "tool1",
          { owner: "facebook", repo: "react" },
          undefined,
          undefined,
          {},
        );

        expect(
          stripAnsi((result.content[0] as TextContent).text),
        ).toMatchSnapshot();
      });
    });

    describe("given gh CLI fails", () => {
      it("then it should return error result", async () => {
        spawnResult = {
          stdout: "",
          stderr: "Could not resolve to a Repository",
          exitCode: 1,
        };

        const result = await tool.execute(
          "tool1",
          { owner: "nonexistent", repo: "repo" },
          undefined,
          undefined,
          {},
        );

        expect((result.content[0] as TextContent).text).toBe(
          "Error: gh api repo failed: Could not resolve to a Repository",
        );
      });
    });
  });

  describe("gh-search-code", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => (call[0] as MockTool).name === "gh-search-code",
      )![0] as MockTool;
    });

    describe("given successful code search", () => {
      it("then it should return formatted results", async () => {
        spawnResult = {
          stdout: JSON.stringify([
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
          ]),
          stderr: "",
          exitCode: 0,
        };

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
});
