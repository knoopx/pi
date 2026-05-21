import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPR } from "../../../shared/testing/test-factories";
import {
  assertCommonFieldLabels,
  assertHasCreatedAndUrl,
  assertTitleWithNumberPrefix,
} from "../test-factories";
import type { GHPR } from "./pr";
import {
  createPrColumns,
  createPrRowMapper,
  createPrFields,
  listPRs,
  viewPR,
} from "./pr";
import { mockGhCmdJson } from "../../../shared/testing/test-factories";

vi.mock("../../../shared/rendering/labels", () => ({
  dotJoin: (s: string) => s,
  stateDot: () => "●",
}));

describe("createPrColumns", () => {
  it("creates columns with number and title keys", () => {
    const columns = createPrColumns();
    expect(columns[0].key).toBe("#");
    expect(columns[1].key).toBe("title");
  });

  it("includes base, head, author, date in formatted output", () => {
    const columns = createPrColumns();
    const formatFn = columns[1].format;
    if (!formatFn) return;
    const result = formatFn(undefined, {
      title: "Add feature",
      base: "main",
      head: "feature-branch",
      author: "octocat",
      date: "1/15/2024",
      url: "https://github.com/o/r/pull/100",
    });
    expect(result).toContain("main ← feature-branch");
    expect(result).toContain("octocat");
  });
});

describe("createPrRowMapper", () => {
  it("maps PR to row with number, title, state", () => {
    const mapper = createPrRowMapper();
    const row = mapper(createMockPR() as unknown as GHPR);
    expect(row["#"]).toBe("#100");
    expect(row.title).toBe("Add feature");
    expect(row.state).toBe("OPEN");
  });

  it("includes base and head branches", () => {
    const mapper = createPrRowMapper();
    const row = mapper(createMockPR() as unknown as GHPR);
    expect(row.base).toBe("main");
    expect(row.head).toBe("feature-branch");
  });

  it("handles PR with no author", () => {
    type AuthorType = { login: string; avatar_url: string; html_url: string };
    const pr = createMockPR({ author: undefined as unknown as AuthorType });
    const mapper = createPrRowMapper();
    const row = mapper(pr as unknown as GHPR);
    expect(row.author).toBe("");
  });
});

describe("createPrFields", () => {
  it("returns fields for title, state, author", () => {
    const fieldFn = createPrFields();
    const fields = fieldFn(createMockPR() as unknown as GHPR);
    assertCommonFieldLabels(fields);
  });

  it("formats title with number prefix", () => {
    const fieldFn = createPrFields();
    const fields = fieldFn(createMockPR() as unknown as GHPR);
    assertTitleWithNumberPrefix(fields, "#100 Add feature");
  });

  it("includes branch field with arrow notation", () => {
    const fieldFn = createPrFields();
    const fields = fieldFn(createMockPR() as unknown as GHPR);
    const branchField = fields.find((f) => f.label === "branch");
    expect(branchField).toBeDefined();
    expect((branchField ?? { value: "" }).value).toBe("main ← feature-branch");
  });

  it("includes mergeable field", () => {
    const fieldFn = createPrFields();
    const fields2 = fieldFn(createMockPR() as unknown as GHPR);
    const mergeableField = fields2.find((f) => f.label === "mergeable");
    expect(mergeableField).toBeDefined();
    expect((mergeableField ?? { value: "" }).value).toBe("true");
  });

  it("shows 'none' for no review decision", () => {
    const fieldFn = createPrFields();
    const fields = fieldFn(
      createMockPR({ reviewDecision: "" }) as unknown as GHPR,
    );
    const reviewField = fields.find((f) => f.label === "review");
    expect(reviewField).toBeDefined();
    expect((reviewField ?? { value: "" }).value).toBe("none");
  });

  it("includes created date and URL", () => {
    const fieldFn = createPrFields();
    const fields = fieldFn(createMockPR() as unknown as GHPR);
    assertHasCreatedAndUrl(fields);
  });

  it("includes reviews field", () => {
    const fieldFn = createPrFields();
    const pr = createMockPR({ reviews: [] });
    const fields = fieldFn(pr as unknown as GHPR);
    const reviewsField = fields.find((f) => f.label === "reviews");
    expect(reviewsField?.value).toBe("none");
  });

  it("formats reviews with author and state", () => {
    const fieldFn = createPrFields();
    const pr = createMockPR({
      reviews: [
        {
          id: "r1",
          body: "LGTM",
          state: "APPROVED" as const,
          createdAt: "2024-01-01T00:00:00Z",
          author: { login: "reviewer", avatar_url: "", html_url: "" },
        },
      ],
    });
    const fields = fieldFn(pr as unknown as GHPR);
    const reviewsField = fields.find((f) => f.label === "reviews");
    expect(reviewsField?.value).toContain("@reviewer");
    expect(reviewsField?.value).toContain("APPROVED");
    expect(reviewsField?.value).toContain("LGTM");
  });
});

describe("listPRs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ghCmdJson with correct args", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await listPRs("owner", "repo");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      expect.arrayContaining(["pr", "list"]),
      "pr list",
    );
  });

  it("passes state filter when provided", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await listPRs("owner", "repo", "closed");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      expect.arrayContaining(["--state=closed"]),
      "pr list",
    );
  });
});

describe("viewPR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls gh pr view and fetches reviews", async () => {
    mockGhCmdJson
      .mockResolvedValueOnce(createMockPR())
      .mockResolvedValueOnce([]);
    const result = await viewPR("owner", "repo", 42);
    expect(result).toBeDefined();
    expect(result.reviews).toEqual([]);
  });

  it("returns PR data with reviews", async () => {
    const reviews = [
      {
        id: "r1",
        body: "LGTM",
        state: "APPROVED" as const,
        createdAt: "2024-01-01T00:00:00Z",
        author: { login: "reviewer", avatar_url: "", html_url: "" },
      },
    ];
    mockGhCmdJson
      .mockResolvedValueOnce(createMockPR({ number: 99 }))
      .mockResolvedValueOnce(reviews);
    const result = await viewPR("owner", "repo", 99);
    expect(result.number).toBe(99);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].body).toBe("LGTM");
  });
});
