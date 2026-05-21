import { describe, it, expect } from "vitest";
import { createErrorResult, pushArrayFlag, buildFilterArgs } from "./registration";

describe("createErrorResult", () => {
  it("creates error result with text content and details", () => {
    const result = createErrorResult<{ error: string }>("something went wrong");
    expect(result.content).toEqual([
      { type: "text", text: "Error: something went wrong" },
    ]);
    expect(result.details).toEqual({ error: "something went wrong" });
  });
});

describe("pushArrayFlag", () => {
  it("pushes multiple flags for array values", () => {
    const args: string[] = [];
    pushArrayFlag(args, ["owner1", "owner2"], "owner");
    expect(args).toEqual(["--owner=owner1", "--owner=owner2"]);
  });

  it("does nothing when values is undefined", () => {
    const args: string[] = ["existing"];
    pushArrayFlag(args, undefined, "label");
    expect(args).toEqual(["existing"]);
  });

  it("does nothing for empty array", () => {
    const args: string[] = [];
    pushArrayFlag(args, [], "repo");
    expect(args).toEqual([]);
  });
});

describe("buildFilterArgs", () => {
  it("builds basic search args with command and limit", () => {
    const args = buildFilterArgs("pr", 30);
    expect(args).toEqual(["search", "pr", "--limit=30"]);
  });

  it("includes query when provided", () => {
    const args = buildFilterArgs("issue", 20, "bug fix");
    expect(args).toContain("bug fix");
  });

  it("includes owner filter as array flags", () => {
    const args = buildFilterArgs("pr", 10, undefined, ["facebook"]);
    expect(args).toContain("--owner=facebook");
  });

  it("includes repo filter as array flags", () => {
    const args = buildFilterArgs(
      "issue",
      10,
      undefined,
      undefined,
      ["react"],
    );
    expect(args).toContain("--repo=react");
  });

  it("includes state filter", () => {
    const args = buildFilterArgs("pr", 10, undefined, undefined, undefined, "open");
    expect(args).toContain("--state=open");
  });

  it("includes label filters as array flags", () => {
    const args = buildFilterArgs(
      "issue",
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      ["bug", "high-priority"],
    );
    expect(args).toContain("--label=bug");
    expect(args).toContain("--label=high-priority");
  });

  it("includes author filter", () => {
    const args = buildFilterArgs(
      "pr",
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "octocat",
    );
    expect(args).toContain("--author=octocat");
  });

  it("includes assignee filter", () => {
    const args = buildFilterArgs(
      "issue",
      10,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "maintainer",
    );
    expect(args).toContain("--assignee=maintainer");
  });

  it("combines all filters together", () => {
    const args = buildFilterArgs(
      "pr",
      50,
      "refactor",
      ["facebook"],
      ["react"],
      "open",
      ["enhancement"],
      "author-name",
      "assignee-name",
    );
    expect(args).toContain("--limit=50");
    expect(args).toContain("refactor");
    expect(args).toContain("--owner=facebook");
    expect(args).toContain("--repo=react");
    expect(args).toContain("--state=open");
    expect(args).toContain("--label=enhancement");
    expect(args).toContain("--author=author-name");
    expect(args).toContain("--assignee=assignee-name");
  });
});
