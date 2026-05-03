import { describe, expect, it } from "vitest";
import {
  getPrIcon,
  getReviewIcon,
  resolvePrStateColor,
  buildPrStats,
  buildPrFixedParts,
  truncateTitle,
  formatReviewIcon,
} from "./helpers";
import type { Theme } from "@mariozechner/pi-coding-agent";

// Mock theme for testing
const mockTheme: Theme = {
  fg: (color: string, text: string) => `[${color}:${text}]`,
  bg: (color: string, text: string) => `{bg:${color}:${text}}`,
} as unknown as Theme;

describe("getPrIcon", () => {
  it("returns draft icon for drafts", () => {
    expect(getPrIcon("OPEN", true)).toBe("󰽾");
    expect(getPrIcon("CLOSED", true)).toBe("󰽾");
  });

  it("returns correct icons for non-draft states", () => {
    expect(getPrIcon("OPEN", false)).toBe("󰐊");
    expect(getPrIcon("CLOSED", false)).toBe("󰅖");
    expect(getPrIcon("MERGED", false)).toBe("󰘬");
  });

  it("returns default icon for unknown states", () => {
    expect(getPrIcon("UNKNOWN", false)).toBe("󰐊");
  });
});

describe("getReviewIcon", () => {
  it("returns correct icons for review decisions", () => {
    expect(getReviewIcon("APPROVED")).toBe("󰄬");
    expect(getReviewIcon("CHANGES_REQUESTED")).toBe("󰌑");
    expect(getReviewIcon("REVIEW_REQUIRED")).toBe("󰈈");
  });

  it("returns empty string for null/empty decisions", () => {
    expect(getReviewIcon(null)).toBe("");
    expect(getReviewIcon("")).toBe("");
  });

  it("returns empty string for unknown decisions", () => {
    expect(getReviewIcon("UNKNOWN")).toBe("");
  });
});

describe("resolvePrStateColor", () => {
  it("returns accent for merged PRs", () => {
    expect(resolvePrStateColor("MERGED", false)).toBe("accent");
  });

  it("returns error for closed PRs (even drafts)", () => {
    expect(resolvePrStateColor("CLOSED", false)).toBe("error");
    expect(resolvePrStateColor("CLOSED", true)).toBe("error");
  });

  it("returns dim for open drafts", () => {
    expect(resolvePrStateColor("OPEN", true)).toBe("dim");
  });

  it("returns success for open non-draft PRs", () => {
    expect(resolvePrStateColor("OPEN", false)).toBe("success");
  });
});

describe("buildPrStats", () => {
  it("formats additions and deletions with theme colors", () => {
    const result = buildPrStats(mockTheme, 100, 50);
    expect(result).toBe("[success:+100]/[error:-50]");
  });

  it("handles zero values", () => {
    const result = buildPrStats(mockTheme, 0, 0);
    expect(result).toBe("[success:+0]/[error:-0]");
  });

  it("handles large numbers", () => {
    const result = buildPrStats(mockTheme, 12345, 6789);
    expect(result).toBe("[success:+12345]/[error:-6789]");
  });
});

describe("buildPrFixedParts", () => {
  it("builds a complete PR info string", () => {
    const result = buildPrFixedParts({
      icon: "󰐊",
      reviewIcon: "󰄬",
      number: 123,
      headRefName: "feature-branch",
      author: "johndoe",
      additions: 42,
      deletions: 7,
      updatedAt: "2024-01-15T10:30:00Z",
    });

    expect(result).toContain("󰐊");
    expect(result).toContain("#123");
    expect(result).toContain("󰄬");
    expect(result).toContain("feature-branch");
    expect(result).toContain("@johndoe");
    expect(result).toContain("+42/-7");
  });

  it("omits review icon when empty", () => {
    const result = buildPrFixedParts({
      icon: "󰐊",
      reviewIcon: "",
      number: 456,
      headRefName: "main",
      author: "janedoe",
      additions: 10,
      deletions: 2,
      updatedAt: "2024-01-15T10:30:00Z",
    });

    expect(result).toContain("#456");
    expect(result).not.toContain("󰄬");
  });
});

describe("truncateTitle", () => {
  it("returns title as-is when within max width", () => {
    const title = "Short Title";
    expect(truncateTitle(title, 20)).toBe(title);
  });

  it("truncates title when exceeding max width", () => {
    const longTitle = "This is a very long title that needs truncation";
    const result = truncateTitle(longTitle, 20);
    expect(result.length).toBe(20);
    expect(result).toBe("This is a very long…");
  });

  it("truncates when title equals max width + 1", () => {
    const title = "Exact Width"; // 11 chars
    const result = truncateTitle(title, 10);
    expect(result.length).toBe(10);
    expect(result).toBe("Exact Wid…");
  });

  it("handles single character over limit", () => {
    const title = "Too Long"; // 8 chars
    const result = truncateTitle(title, 7);
    expect(result).toBe("Too Lo…");
  });
});

describe("formatReviewIcon", () => {
  it("returns empty string when no review icon", () => {
    expect(formatReviewIcon("", "APPROVED", mockTheme)).toBe("");
    expect(
      formatReviewIcon(null as unknown as string, "APPROVED", mockTheme),
    ).toBe("");
  });

  it("applies success color for approved reviews", () => {
    const result = formatReviewIcon("󰄬", "APPROVED", mockTheme);
    expect(result).toBe("[success:󰄬] ");
  });

  it("applies warning color for changes requested", () => {
    const result = formatReviewIcon("󰌑", "CHANGES_REQUESTED", mockTheme);
    expect(result).toBe("[warning:󰌑] ");
  });

  it("applies warning color for null decision", () => {
    const result = formatReviewIcon("󰈈", null, mockTheme);
    expect(result).toBe("[warning:󰈈] ");
  });
});
