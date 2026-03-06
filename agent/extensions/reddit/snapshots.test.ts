/**
 * Snapshot tests for Reddit tool output formatting.
 */

import { describe, expect, it } from "vitest";
import { formatPostTable } from "./index";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("reddit output snapshots", () => {
  it("renders a post table", () => {
    const posts = [
      {
        title: "NixOS 24.05 released with major improvements",
        author: "nixos_dev",
        score: 1420,
        comments: 230,
        age: "3h ago",
        link: "https://reddit.com/r/linux/abc123",
        url: "https://nixos.org/blog/announcements/2024/nixos-2405",
      },
      {
        title: "Why I switched from Arch to NixOS",
        author: "linux_user42",
        score: 87,
        comments: 45,
        age: "6h ago",
        link: "https://reddit.com/r/linux/def456",
        url: "https://reddit.com/r/linux/def456",
      },
      {
        title: "TIL about fd-find",
        author: "cli_fan",
        score: 5,
        comments: 3,
        age: "1d ago",
        link: "https://reddit.com/r/linux/ghi789",
        url: "https://github.com/sharkdp/fd",
      },
    ];

    expect(stripAnsi(formatPostTable(posts))).toMatchSnapshot();
  });

  it("renders a single post table", () => {
    const posts = [
      {
        title: "Ask HN: What are you working on?",
        author: "curious",
        score: 42,
        comments: 100,
        age: "2h ago",
        link: "https://reddit.com/r/AskReddit/xyz",
        url: "https://reddit.com/r/AskReddit/xyz",
      },
    ];

    expect(stripAnsi(formatPostTable(posts))).toMatchSnapshot();
  });
});
