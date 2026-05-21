import { describe, it, expect } from "vitest";
import { renderComment } from "./comment";
import type { RedditCommentData } from "./types";

function makeComment(
  overrides: Partial<RedditCommentData> = {},
): RedditCommentData {
  return {
    id: "comment_id",
    author: "testuser",
    body: "This is a test comment",
    score: 42,
    created_utc: 1705312800,
    replies: { data: { children: [] } },
    ...overrides,
  };
}

function result(comment: RedditCommentData): string {
  return renderComment(comment, 0).join("\n");
}

describe("renderComment", () => {
  it("renders author and body", () => {
    const r = result(makeComment());
    expect(r).toContain("**testuser**");
    expect(r).toContain("This is a test comment");
  });

  it("renders score with formatting", () => {
    const r = result(makeComment({ score: 1234 }));
    expect(r).toContain("(1234)");
  });

  it("handles zero score", () => {
    const r = result(makeComment({ score: 0 }));
    expect(r).toContain("**testuser**");
  });

  it("renders reply children recursively", () => {
    const child: RedditCommentData = {
      id: "reply_id",
      author: "replyuser",
      body: "This is a reply",
      score: 10,
      created_utc: 1705312800,
      replies: { data: { children: [] } },
    };
    const comment = makeComment({
      replies: {
        data: {
          children: [{ kind: "t1", data: child }],
        },
      },
    });
    const r = result(comment);
    expect(r).toContain("**replyuser**");
    expect(r).toContain("This is a reply");
  });

  it("skips 'more' children", () => {
    const comment = makeComment({
      replies: {
        data: {
          children: [{ kind: "more", data: {} as RedditCommentData }],
        },
      },
    });
    const r = result(comment);
    expect(r).not.toContain("more");
  });

  it("handles empty body", () => {
    const r = result(makeComment({ body: "" }));
    expect(r).toContain("[deleted]");
  });
});
