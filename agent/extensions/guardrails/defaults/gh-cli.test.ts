import { describe, it, expect } from "vitest";
import defaults from "./gh-cli";
import { commandGroupMatches } from "../test-helpers";

describe("gh-cli", () => {
  it("then blocks destructive gh operations", () => {
    const destructive = [
      "gh repo delete my-repo",
      "gh repo archive my-repo",
      "gh repo rename my-repo new-name",
      "gh release delete v1.0.0",
      "gh issue delete 42",
      "gh gist delete abc123",
      "gh run delete 12345",
      "gh label delete bug",
      "gh secret delete MY_SECRET",
      "gh variable delete MY_VAR",
    ];
    for (const cmd of destructive) {
      expect(commandGroupMatches(defaults, "gh-cli", cmd)).toBe(true);
    }
  });

  it("then allows safe gh operations", () => {
    const safe = [
      "gh repo view",
      "gh issue list",
      "gh issue close 42",
      "gh pr create",
      "gh run cancel 12345",
      "gh secret list",
    ];
    for (const cmd of safe) {
      expect(commandGroupMatches(defaults, "gh-cli", cmd)).toBe(false);
    }
  });
});
