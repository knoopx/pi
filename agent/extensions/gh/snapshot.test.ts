import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
  MockExtensionAPI,
  MockTool,
} from "../../shared/testing/test-factories";
import { createMockExtensionAPI } from "../../shared/testing/test-factories";
import { mockGhCmdJson } from "../../shared/testing/test-factories";
import type { GHPR, GHPRReview } from "./api/pr";
import type { GHIssue, GHIssueComment } from "./api/issue";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf-8")) as T;
}

const pr = loadFixture<GHPR>("pr-523948.json");
const prReviews = loadFixture<GHPRReview[]>("pr-523948-reviews.json");
const issueOpen = loadFixture<GHIssue>("issue-523948.json");
const issueComments = loadFixture<GHIssueComment[]>("issue-523948-comments.json");

vi.mock("../../shared/process/gh-cmd", () => ({
  ghCmd: vi.fn(),
  ghCmdJson: mockGhCmdJson,
  ghCmdJsonWithInput: vi.fn(),
}));

const mockCtx = {
  cwd: "/tmp",
  abort: () => {},
  hasUI: false,
};

async function executeView(
  tool: MockTool,
  owner: string,
  repo: string,
  number: number,
): Promise<string> {
  const result = await tool.execute(
    "id",
    { owner, repo, number },
    undefined,
    undefined,
    mockCtx,
  );
  return (result.content[0] as { text: string }).text;
}

// Register the GH extension and find a tool by name.
async function registerTool(name: string): Promise<MockTool> {
  const mockPi = createMockExtensionAPI();
  const { default: ext } = await import("./index");
  ext(mockPi as ExtensionAPI);
  const calls = mockPi.registerTool.mock.calls as [MockTool][];
  const found = calls.find((c) => c[0]?.name === name);
  if (!found) throw new Error(`${name} tool not registered`);
  return found[0];
}

describe("gh-view-issue output snapshots", () => {
  let _mockPi: MockExtensionAPI;
  let tool: MockTool;

  beforeEach(async () => {
    vi.clearAllMocks();
    _mockPi = createMockExtensionAPI();
    tool = await registerTool("gh-view-issue");
  });

  it("renders issue without comments", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(issueOpen)
      .mockResolvedValueOnce([]);

    const text = await executeView(tool, "NixOS", "nixpkgs", 523948);
    expect(text).toMatchSnapshot();
  });

  it("renders issue with single comment", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(issueOpen)
      .mockResolvedValueOnce([issueComments[0]]);

    const text = await executeView(tool, "NixOS", "nixpkgs", 523948);
    expect(text).toMatchSnapshot();
  });

  it("renders issue with multiple comments", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(issueOpen)
      .mockResolvedValueOnce(issueComments);

    const text = await executeView(tool, "NixOS", "nixpkgs", 523948);
    expect(text).toMatchSnapshot();
  });

  it("renders issue with null comment author", async () => {
    const commentWithNullAuthor: GHIssueComment = {
      id: "IC_kwDOAEVQ_M8AAAABEZ7orA",
      body: "This pull request has been mentioned on NixOS Discourse.",
      createdAt: "2026-06-01T07:53:38Z",
      author: null,
    };
    mockGhCmdJson
      .mockResolvedValueOnce(issueOpen)
      .mockResolvedValueOnce([commentWithNullAuthor]);

    const text = await executeView(tool, "NixOS", "nixpkgs", 523948);
    expect(text).toMatchSnapshot();
  });
});

describe("gh-view-pr output snapshots", () => {
  let _mockPi: MockExtensionAPI;
  let tool: MockTool;

  beforeEach(async () => {
    vi.clearAllMocks();
    _mockPi = createMockExtensionAPI();
    tool = await registerTool("gh-view-pr");
  });

  it("renders PR without reviews", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(pr)
      .mockResolvedValueOnce([]);

    const text = await executeView(tool, "NixOS", "nixpkgs", 523948);
    expect(text).toMatchSnapshot();
  });

  it("renders PR with approved review", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(pr)
      .mockResolvedValueOnce([prReviews[0]]);

    const text = await executeView(tool, "NixOS", "nixpkgs", 523948);
    expect(text).toMatchSnapshot();
  });

  it("renders PR with all reviews", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(pr)
      .mockResolvedValueOnce(prReviews);

    const text = await executeView(tool, "NixOS", "nixpkgs", 523948);
    expect(text).toMatchSnapshot();
  });
});
