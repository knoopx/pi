import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type {
  MockExtensionAPI,
  MockTool,
} from "../../shared/testing/test-factories";
import { createMockExtensionAPI } from "../../shared/testing/test-factories";
import { mockGhCmdJson } from "../../shared/testing/test-factories";

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
      .mockResolvedValueOnce({
        number: 42,
        title: "Fix crash on startup",
        state: "OPEN",
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-16T12:00:00Z",
        author: { login: "octocat", avatar_url: "", html_url: "" },
        body: "The app crashes when opened.",
        html_url: "https://github.com/owner/repo/issues/42",
        labels: [{ name: "bug", description: "", color: "red" }],
        milestone: null,
      })
      .mockResolvedValueOnce([]);

    const result = await tool.execute(
      "id",
      { owner: "owner", repo: "repo", number: 42 },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toMatchSnapshot();
  });

  it("renders issue with single comment", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce({
        number: 10,
        title: "Add dark mode",
        state: "OPEN",
        createdAt: "2024-02-01T08:00:00Z",
        updatedAt: "2024-02-01T09:00:00Z",
        author: { login: "designer", avatar_url: "", html_url: "" },
        body: "Users want a dark mode option.",
        html_url: "https://github.com/owner/repo/issues/10",
        labels: [{ name: "enhancement", description: "", color: "blue" }],
        milestone: { title: "v2.0", description: "", dueOn: "" },
      })
      .mockResolvedValueOnce([
        {
          id: "c1",
          body: "I can work on this next sprint.",
          createdAt: "2024-02-01T10:00:00Z",
          author: { login: "dev", avatar_url: "", html_url: "" },
        },
      ]);

    const result = await tool.execute(
      "id",
      { owner: "owner", repo: "repo", number: 10 },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toMatchSnapshot();
  });

  it("renders issue with multiple comments", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce({
        number: 5,
        title: "Security vulnerability in auth",
        state: "CLOSED",
        createdAt: "2024-03-01T00:00:00Z",
        updatedAt: "2024-03-05T00:00:00Z",
        author: { login: "sec-team", avatar_url: "", html_url: "" },
        body: "Token validation bypass in /api/auth.",
        html_url: "https://github.com/owner/repo/issues/5",
        labels: [
          { name: "security", description: "", color: "red" },
          { name: "critical", description: "", color: "red" },
        ],
        milestone: { title: "v1.1", description: "", dueOn: "" },
      })
      .mockResolvedValueOnce([
        {
          id: "c1",
          body: "Confirmed, patching now.",
          createdAt: "2024-03-01T01:00:00Z",
          author: { login: "lead", avatar_url: "", html_url: "" },
        },
        {
          id: "c2",
          body: "Fix merged in #99.",
          createdAt: "2024-03-02T12:00:00Z",
          author: { login: "lead", avatar_url: "", html_url: "" },
        },
        {
          id: "c3",
          body: "Verified the fix works.",
          createdAt: "2024-03-05T09:00:00Z",
          author: { login: "tester", avatar_url: "", html_url: "" },
        },
      ]);

    const result = await tool.execute(
      "id",
      { owner: "owner", repo: "repo", number: 5 },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toMatchSnapshot();
  });

  it("renders issue with null comment author", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce({
        number: 7,
        title: "Ghost issue",
        state: "OPEN",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        author: { login: "ghost", avatar_url: "", html_url: "" },
        body: "Something weird happened.",
        html_url: "https://github.com/owner/repo/issues/7",
        labels: [],
        milestone: null,
      })
      .mockResolvedValueOnce([
        {
          id: "c1",
          body: "Comment from deleted user",
          createdAt: "2024-01-02T00:00:00Z",
          author: null,
        },
      ]);

    const result = await tool.execute(
      "id",
      { owner: "owner", repo: "repo", number: 7 },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toMatchSnapshot();
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
      .mockResolvedValueOnce({
        number: 50,
        title: "Refactor auth module",
        state: "OPEN",
        createdAt: "2024-01-20T10:00:00Z",
        updatedAt: "2024-01-21T12:00:00Z",
        baseRefName: "main",
        headRefName: "refactor-auth",
        author: { login: "dev", avatar_url: "", html_url: "" },
        body: "Clean up the auth module.",
        html_url: "https://github.com/owner/repo/pull/50",
        mergeable: "true",
        reviewDecision: "",
      })
      .mockResolvedValueOnce([]);

    const result = await tool.execute(
      "id",
      { owner: "owner", repo: "repo", number: 50 },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toMatchSnapshot();
  });

  it("renders PR with approved review", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce({
        number: 55,
        title: "Add CI pipeline",
        state: "OPEN",
        createdAt: "2024-02-10T08:00:00Z",
        updatedAt: "2024-02-11T09:00:00Z",
        baseRefName: "main",
        headRefName: "add-ci",
        author: { login: "devops", avatar_url: "", html_url: "" },
        body: "Add GitHub Actions workflow.",
        html_url: "https://github.com/owner/repo/pull/55",
        mergeable: "true",
        reviewDecision: "APPROVED",
      })
      .mockResolvedValueOnce([
        {
          id: "r1",
          body: "LGTM, looks good.",
          state: "APPROVED",
          createdAt: "2024-02-10T10:00:00Z",
          author: { login: "lead", avatar_url: "", html_url: "" },
        },
      ]);

    const result = await tool.execute(
      "id",
      { owner: "owner", repo: "repo", number: 55 },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toMatchSnapshot();
  });

  it("renders PR with multiple reviews including changes requested", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce({
        number: 60,
        title: "Rewrite parser",
        state: "OPEN",
        createdAt: "2024-03-01T00:00:00Z",
        updatedAt: "2024-03-03T00:00:00Z",
        baseRefName: "main",
        headRefName: "rewrite-parser",
        author: { login: "senior-dev", avatar_url: "", html_url: "" },
        body: "Complete rewrite of the parser module.",
        html_url: "https://github.com/owner/repo/pull/60",
        mergeable: "true",
        reviewDecision: "CHANGES_REQUESTED",
      })
      .mockResolvedValueOnce([
        {
          id: "r1",
          body: "Please add error handling for edge cases.",
          state: "CHANGES_REQUESTED",
          createdAt: "2024-03-01T12:00:00Z",
          author: { login: "reviewer", avatar_url: "", html_url: "" },
        },
        {
          id: "r2",
          body: "Updated with error handling.",
          state: "COMMENTED",
          createdAt: "2024-03-02T09:00:00Z",
          author: { login: "senior-dev", avatar_url: "", html_url: "" },
        },
        {
          id: "r3",
          body: "Looks good now.",
          state: "APPROVED",
          createdAt: "2024-03-03T10:00:00Z",
          author: { login: "reviewer", avatar_url: "", html_url: "" },
        },
      ]);

    const result = await tool.execute(
      "id",
      { owner: "owner", repo: "repo", number: 60 },
      undefined,
      undefined,
      mockCtx,
    );
    expect((result.content[0] as { text: string }).text).toMatchSnapshot();
  });
});
