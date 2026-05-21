import { describe, it, expect } from "vitest";
import { buildListArgs, buildViewArgs } from "./base";

describe("buildListArgs", () => {
  it("builds basic list args without state filter", () => {
    const args = buildListArgs(
      "pr",
      "facebook",
      "react",
      undefined,
      30,
      "number,title",
    );
    expect(args).toEqual([
      "pr",
      "list",
      "-R",
      "facebook/react",
      "--limit=30",
      "--json=number,title",
      "--jq",
      "[.[] | . + {html_url: .url}]",
    ]);
  });

  it("includes state filter when state is provided", () => {
    const args = buildListArgs(
      "issue",
      "microsoft",
      "vscode",
      "closed",
      50,
      "number,title,state",
    );
    expect(args).toContain("--state=closed");
  });

  it("omits state filter when state is 'all'", () => {
    const args = buildListArgs(
      "pr",
      "torvalds",
      "linux",
      "all",
      10,
      "number",
    );
    expect(args).not.toContain("--state=all");
  });

  it("builds args for merged state", () => {
    const args = buildListArgs(
      "pr",
      "golang",
      "go",
      "merged",
      20,
      "number,title",
    );
    expect(args).toContain("--state=merged");
  });
});

describe("buildViewArgs", () => {
  it("builds view args with number and json fields", () => {
    const args = buildViewArgs("pr", "facebook", "react", 123, "number,title");
    expect(args).toEqual([
      "pr",
      "view",
      "123",
      "-R",
      "facebook/react",
      "--json=number,title",
      "--jq",
      ". + {html_url: .url}",
    ]);
  });

  it("builds view args for issue resource", () => {
    const args = buildViewArgs(
      "issue",
      "microsoft",
      "vscode",
      456,
      "number,title,body",
    );
    expect(args).toContain("issue");
    expect(args).toContain("456");
    expect(args).toContain("-R");
    expect(args).toContain("microsoft/vscode");
  });
});
