import { describe, it, expect } from "vitest";
import defaults from "./jj";
import { commandGroupMatches } from "../test-helpers";

describe("jj-not-git", () => {
  it("then blocks git, allows jj", () => {
    expect(commandGroupMatches(defaults, "jj-not-git", "git status")).toBe(
      true,
    );
    expect(commandGroupMatches(defaults, "jj-not-git", "jj st")).toBe(false);
  });
});

describe("jj", () => {
  it("then blocks jj edit, instructs new+ squash", () => {
    expect(commandGroupMatches(defaults, "jj", "jj edit abc123")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj edit @-")).toBe(true);
  });

  it("then blocks wrong parent syntax", () => {
    expect(commandGroupMatches(defaults, "jj", "jj diff -r @~1")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj log -r @^")).toBe(true);
  });

  it("then blocks destructive/interactive commands", () => {
    expect(commandGroupMatches(defaults, "jj", "jj revert")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj restore")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj diffedit")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj undo")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj forget")).toBe(true);
  });

  it("then blocks editor-opening commands without -m", () => {
    expect(commandGroupMatches(defaults, "jj", "jj squash")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj split")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj describe")).toBe(true);
  });

  it("then allows editor-opening commands with -m", () => {
    expect(commandGroupMatches(defaults, "jj", "jj squash -m 'msg'")).toBe(
      false,
    );
    expect(
      commandGroupMatches(defaults, "jj", "jj split -m 'msg' file.ts"),
    ).toBe(false);
    expect(commandGroupMatches(defaults, "jj", "jj describe -m 'msg'")).toBe(
      false,
    );
  });

  it("then allows non-interactive restore with --file", () => {
    expect(
      commandGroupMatches(
        defaults,
        "jj",
        "jj restore --file Records/Bookmarks.csv",
      ),
    ).toBe(false);
    expect(commandGroupMatches(defaults, "jj", "jj restore")).toBe(true);
  });

  it("then blocks interactive flags", () => {
    expect(commandGroupMatches(defaults, "jj", "jj squash -i")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj split --interactive")).toBe(
      true,
    );
  });

  it("then confirms jj git push", () => {
    expect(commandGroupMatches(defaults, "jj", "jj git push")).toBe(true);
    expect(commandGroupMatches(defaults, "jj", "jj git fetch")).toBe(false);
  });
});

describe("git-push", () => {
  it("then confirms git push, allows other git commands", () => {
    expect(
      commandGroupMatches(defaults, "git-push", "git push origin main"),
    ).toBe(true);
    expect(commandGroupMatches(defaults, "git-push", "git pull")).toBe(false);
  });
});
