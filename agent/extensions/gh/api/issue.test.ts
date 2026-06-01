import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockIssue } from "../../../shared/testing/test-factories";
import {
  assertCommonFieldLabels,
  assertFieldValue,
  assertHasCreatedAndUrl,
  assertTitleWithNumberPrefix,
  loadFixture,
} from "../test-factories";
import type { GHIssue, GHIssueComment } from "./issue";
import {
  createIssueColumns,
  createIssueRowMapper,
  createIssueFields,
  listIssues,
  viewIssue,
} from "./issue";
import { mockGhCmdJson } from "../../../shared/testing/test-factories";

const issue523948 = loadFixture<GHIssue>("issue-523948.json");
const issueComments = loadFixture<GHIssueComment[]>("issue-523948-comments.json");

// Build comments field value from comment overrides.
function getCommentsField(
  comments: Partial<GHIssue["comments"]>[number][],
): string | undefined {
  const fields = createIssueFields()(
    createMockIssue({ comments }) as unknown as GHIssue,
  );
  return fields.find((f) => f.label === "comments")?.value;
}

describe("createIssueColumns", () => {
  it("creates columns with number and title keys", () => {
    const columns = createIssueColumns();
    expect(columns[0].key).toBe("#");
    expect(columns[1].key).toBe("title");
  });

  it("includes author, date, and labels in formatted output", () => {
    const columns = createIssueColumns();
    const formatFn = columns[1].format;
    if (!formatFn) return;
    const result = formatFn(undefined, {
      title: "Fix bug",
      author: "octocat",
      date: "1/15/2024",
      url: "https://github.com/o/r/issues/42",
      labels: "bug, enhancement",
    });
    expect(result).toContain("octocat");
    expect(result).toContain("1/15/2024");
    expect(result).toContain("bug, enhancement");
  });

  it("omits labels from formatted output when none", () => {
    const columns = createIssueColumns();
    const formatFn = columns[1].format;
    if (!formatFn) return;
    const result = formatFn(undefined, {
      title: "Fix bug",
      author: "octocat",
      date: "1/15/2024",
      url: "https://github.com/o/r/issues/42",
    });
    expect(result).not.toContain("none");
  });
});

describe("createIssueRowMapper", () => {
  it("maps issue to row with number, title, state", () => {
    const mapper = createIssueRowMapper();
    const row = mapper(createMockIssue() as unknown as GHIssue);
    expect(row["#"]).toBe("#42");
    expect(row.title).toBe("Fix bug");
    expect(row.state).toBe("OPEN");
  });

  it("includes author login and formatted date", () => {
    const mapper = createIssueRowMapper();
    const row = mapper(createMockIssue() as unknown as GHIssue);
    expect(row.author).toBe("octocat");
    expect(row.date).toContain("2024");
  });

  it("includes labels as comma-separated string", () => {
    const issue = createMockIssue({
      labels: [
        { name: "bug", description: "", color: "red" },
        { name: "high-priority", description: "", color: "green" },
      ],
    });
    const mapper = createIssueRowMapper();
    const row = mapper(issue as unknown as GHIssue);
    expect(row.labels).toBe("bug, high-priority");
  });

  it("handles issue with no labels", () => {
    const issue = createMockIssue({ labels: [] });
    const mapper = createIssueRowMapper();
    const row = mapper(issue as unknown as GHIssue);
    expect(row.labels).toBe("");
  });

  it("handles issue with no author", () => {
    type AuthorType = { login: string; avatar_url: string; html_url: string };
    const issue = createMockIssue({
      author: undefined as unknown as AuthorType,
    });
    const mapper = createIssueRowMapper();
    const row = mapper(issue as unknown as GHIssue);
    expect(row.author).toBe("");
  });
});

describe("createIssueFields", () => {
  it("returns fields for title, state, author", () => {
    const fieldFn = createIssueFields();
    const fields = fieldFn(createMockIssue() as unknown as GHIssue);
    assertCommonFieldLabels(fields);
  });

  it("formats title with number prefix", () => {
    const fieldFn = createIssueFields();
    const fields = fieldFn(createMockIssue() as unknown as GHIssue);
    assertTitleWithNumberPrefix(fields, "#42 Fix bug");
  });

  it("includes labels field", () => {
    const fieldFn = createIssueFields();
    const fields = fieldFn(createMockIssue() as unknown as GHIssue);
    assertFieldValue(fields, "labels", "bug");
  });

  it("shows 'none' for no labels", () => {
    const fieldFn = createIssueFields();
    const fields = fieldFn(
      createMockIssue({ labels: [] }) as unknown as GHIssue,
    );
    assertFieldValue(fields, "labels", "none");
  });

  it("includes milestone field", () => {
    const fieldFn = createIssueFields();
    const fields = fieldFn(createMockIssue() as unknown as GHIssue);
    assertFieldValue(fields, "milestone", "v1.0");
  });

  it("shows 'none' for no milestone", () => {
    const fieldFn = createIssueFields();
    const fields = fieldFn(
      createMockIssue({ milestone: null }) as unknown as GHIssue,
    );
    assertFieldValue(fields, "milestone", "none");
  });

  it("includes created date and URL", () => {
    const fieldFn = createIssueFields();
    const fields = fieldFn(createMockIssue() as unknown as GHIssue);
    assertHasCreatedAndUrl(fields);
  });

  it("includes comments field", () => {
    const fieldFn = createIssueFields();
    const issue = createMockIssue({ comments: [] });
    const fields = fieldFn(issue as unknown as GHIssue);
    assertFieldValue(fields, "comments", "none");
  });

  it("formats single comment with author and body", () => {
    const value = getCommentsField([
      {
        id: "c1",
        body: "Looks good",
        createdAt: "2024-01-01T00:00:00Z",
        author: { login: "reviewer", avatar_url: "", html_url: "" },
      },
    ]);
    expect(value).toContain("@reviewer");
    expect(value).toContain("Looks good");
    expect(value).not.toContain("---");
  });

  it("separates multiple comments with ---", () => {
    const value = getCommentsField([
      {
        id: "c1",
        body: "First comment",
        createdAt: "2024-01-01T00:00:00Z",
        author: { login: "alice", avatar_url: "", html_url: "" },
      },
      {
        id: "c2",
        body: "Second comment",
        createdAt: "2024-01-02T00:00:00Z",
        author: { login: "bob", avatar_url: "", html_url: "" },
      },
    ]);
    expect(value).toContain("@alice");
    expect(value).toContain("First comment");
    expect(value).toContain("---");
    expect(value).toContain("@bob");
    expect(value).toContain("Second comment");
  });

  it("falls back to unknown when author is null", () => {
    const value = getCommentsField([
      {
        id: "c1",
        body: "Ghost comment",
        createdAt: "2024-01-01T00:00:00Z",
        author: null,
      },
    ]);
    expect(value).toContain("@unknown");
    expect(value).toContain("Ghost comment");
  });
});

describe("listIssues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ghCmdJson with correct args", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await listIssues("owner", "repo");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      expect.arrayContaining(["issue", "list"]),
      "issue list",
    );
  });

  it("passes state filter when provided", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await listIssues("owner", "repo", "closed");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      expect.arrayContaining(["--state=closed"]),
      "issue list",
    );
  });
});

describe("viewIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls gh issue view and fetches comments", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(issue523948)
      .mockResolvedValueOnce([]);
    const result = await viewIssue("NixOS", "nixpkgs", 523948);
    expect(result).toBeDefined();
    expect(result.comments).toEqual([]);
  });

  it("calls comments API endpoint for the correct issue", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(issue523948)
      .mockResolvedValueOnce([]);
    await viewIssue("NixOS", "nixpkgs", 523948);
    expect(mockGhCmdJson).toHaveBeenCalledTimes(2);
    const commentsCall = mockGhCmdJson.mock.calls[1];
    expect(commentsCall[0]).toContain("repos/NixOS/nixpkgs/issues/523948/comments");
  });

  it("returns issue data with comments", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(issue523948)
      .mockResolvedValueOnce(issueComments);
    const result = await viewIssue("NixOS", "nixpkgs", 523948);
    expect(result.number).toBe(523948);
    expect(result.comments.length).toBeGreaterThan(0);
    expect(result.comments[0].author?.login).toBeDefined();
  });
});
