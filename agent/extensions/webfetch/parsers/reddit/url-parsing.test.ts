import { describe, it, expect } from "vitest";
import { parseRedditUrl } from "./url-parsing";

describe("parseRedditUrl", () => {
  it("parses frontpage URL", () => {
    expect(parseRedditUrl("https://www.reddit.com/")).toEqual({
      kind: "frontpage",
    });
  });

  it("parses old.reddit.com frontpage", () => {
    expect(parseRedditUrl("https://old.reddit.com/")).toEqual({
      kind: "frontpage",
    });
  });

  it("parses subreddit URL", () => {
    const result = parseRedditUrl("https://www.reddit.com/r/typescript/");
    expect(result).toEqual({
      kind: "subreddit",
      sub: "typescript",
      sort: "hot",
    });
  });

  it("parses subreddit with sort", () => {
    const result = parseRedditUrl("https://www.reddit.com/r/typescript/top/");
    expect(result).toEqual({
      kind: "subreddit",
      sub: "typescript",
      sort: "top",
    });
  });

  it("parses subreddit with submitted sort", () => {
    const result = parseRedditUrl(
      "https://www.reddit.com/r/typescript/submitted/",
    );
    expect(result).toEqual({
      kind: "subreddit",
      sub: "typescript",
      sort: "top",
    });
  });

  it("parses thread URL", () => {
    const result = parseRedditUrl(
      "https://www.reddit.com/r/typescript/comments/abc123/title/",
    );
    expect(result).toEqual({ kind: "thread", id: "abc123", sub: "" });
  });

  it("parses comments URL", () => {
    const result = parseRedditUrl("https://www.reddit.com/comments/xyz789/");
    expect(result).toEqual({ kind: "thread", id: "xyz789" });
  });

  it("parses user URL", () => {
    const result = parseRedditUrl("https://www.reddit.com/user/octocat/");
    expect(result).toEqual({ kind: "user", user: "octocat" });
  });

  it("parses u/ user URL", () => {
    const result = parseRedditUrl("https://www.reddit.com/u/octocat/");
    expect(result).toEqual({ kind: "user", user: "octocat" });
  });

  it("parses multi subreddit URL", () => {
    const result = parseRedditUrl("https://www.reddit.com/m/devteam/");
    expect(result).toEqual({ kind: "multi", subs: [] });
  });

  it("parses search URL", () => {
    const result = parseRedditUrl(
      "https://www.reddit.com/r/typescript/search/",
    );
    expect(result).toEqual({
      kind: "search",
      sub: "typescript",
      query: "",
      sort: "relevance",
    });
  });

  it("returns null for non-reddit URL", () => {
    expect(parseRedditUrl("https://www.example.com/")).toBeNull();
  });

  it("handles trailing slashes", () => {
    const result = parseRedditUrl("https://www.reddit.com/r/typescript///");
    expect(result).toEqual({
      kind: "subreddit",
      sub: "typescript",
      sort: "hot",
    });
  });
});
