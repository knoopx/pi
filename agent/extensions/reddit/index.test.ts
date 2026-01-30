/**
 * Unit Tests for Reddit Extension
 * Tests: Relative time formatting, score extraction, and JSON parsing
 */

import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  extractScore,
  parseRedditJson,
  SPINNER_FRAMES,
  truncateToWidth,
  visibleWidth,
} from "./index";

// ============================================================================
// Relative Time Formatting Tests
// ============================================================================

describe("Relative Time Formatting", () => {
  describe("given seconds ago", () => {
    it("then formatRelativeTime should return 'just now'", () => {
      const date = new Date();
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("just now");
    });
  });

  describe("given minutes ago", () => {
    it("then formatRelativeTime should return 'Xm ago'", () => {
      const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("5m ago");
    });

    it("then it should handle multiple minutes", () => {
      const date = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("30m ago");
    });
  });

  describe("given hours ago", () => {
    it("then formatRelativeTime should return 'Xh ago'", () => {
      const date = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("2h ago");
    });

    it("then it should handle multiple hours", () => {
      const date = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("1d ago");
    });
  });

  describe("given days ago", () => {
    it("then formatRelativeTime should return 'Xd ago'", () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("2d ago");
    });

    it("then it should handle multiple days", () => {
      const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("1w ago");
    });
  });

  describe("given weeks ago", () => {
    it("then formatRelativeTime should return 'Xw ago'", () => {
      const date = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 2 weeks ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("2w ago");
    });

    it("then it should handle multiple weeks", () => {
      const date = new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000); // 4 weeks ago
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("4w ago");
    });
  });

  describe("given months ago", () => {
    it("then formatRelativeTime should return 'Xmo ago'", () => {
      const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 2 months ago (approx)
      const result = formatRelativeTime(date.toISOString());
      expect(result).toBe("2mo ago");
    });
  });
});

// ============================================================================
// Score Extraction Tests
// ============================================================================

describe("Score Extraction", () => {
  describe("given content with points", () => {
    it("then extractScore should extract numeric score", () => {
      const content = "Post content with 42 points";
      const result = extractScore(content);
      expect(result).toBe(42);
    });

    it("then it should handle lowercase points", () => {
      const content = "Post content with 15 points";
      const result = extractScore(content);
      expect(result).toBe(15);
    });
  });

  describe("given content without points", () => {
    it("then extractScore should return 0", () => {
      const content = "Post content without points";
      const result = extractScore(content);
      expect(result).toBe(0);
    });

    it("then it should handle empty content", () => {
      const content = "";
      const result = extractScore(content);
      expect(result).toBe(0);
    });
  });

  describe("given content with multiple points", () => {
    it("then extractScore should extract first match", () => {
      const content = "Post with 10 points and another 20 points";
      const result = extractScore(content);
      expect(result).toBe(10);
    });
  });
});

// ============================================================================
// Reddit JSON Parsing Tests
// ============================================================================

describe("Reddit JSON Parsing", () => {
  describe("given valid Reddit JSON", () => {
    it("then parseRedditJson should return structured data", () => {
      const json = {
        kind: "Listing",
        data: {
          children: [
            {
              kind: "t3",
              data: {
                id: "abc123",
                title: "Test Post",
                author: "testuser",
                created_utc: "1609459200",
                score: 100,
                url: "https://example.com/post",
              },
            },
          ],
        },
      };
      const result = parseRedditJson(JSON.stringify(json), "hot");
      expect(result).toBeDefined();
      expect(result?.posts).toHaveLength(1);
      expect(result?.posts[0].title).toBe("Test Post");
    });
  });

  describe("given error response", () => {
    it("then parseRedditJson should throw error", () => {
      const json = {
        reason: "banned_subreddit",
        error: 403,
        message: "Subreddit is banned",
      };
      expect(() => parseRedditJson(JSON.stringify(json), "hot")).toThrow();
    });
  });

  describe("given invalid format", () => {
    it("then parseRedditJson should throw error", () => {
      const json = "invalid json";
      expect(() => parseRedditJson(json, "hot")).toThrow();
    });
  });
});

// ============================================================================
// Spinner Frames Tests
// ============================================================================

describe("Spinner Frames", () => {
  describe("given spinner animation", () => {
    it("then frames should be in order", () => {
      expect(SPINNER_FRAMES).toHaveLength(10);
      expect(SPINNER_FRAMES[0]).toBe("⠋");
      expect(SPINNER_FRAMES[9]).toBe("⠏");
    });

    it("then frames should be unique", () => {
      const unique = new Set(SPINNER_FRAMES);
      expect(unique.size).toBe(SPINNER_FRAMES.length);
    });
  });
});

// ============================================================================
// String Truncation Tests
// ============================================================================

describe("String Truncation", () => {
  describe("given long text", () => {
    it("then truncateToWidth should truncate", () => {
      const text =
        "This is a very long string that needs to be truncated to fit a specific width";
      const result = truncateToWidth(text, 50);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toContain("...");
    });

    it("then it should handle short text", () => {
      const text = "Short";
      const result = truncateToWidth(text, 50);
      expect(result).toBe("Short");
    });
  });

  describe("given exact width match", () => {
    it("then it should not add ellipsis", () => {
      const text = "1234567890";
      const result = truncateToWidth(text, 10);
      expect(result.length).toBe(10);
      expect(result).not.toContain("...");
    });
  });
});

// ============================================================================
// Visible Width Tests
// ============================================================================

describe("Visible Width", () => {
  describe("given ASCII characters", () => {
    it("then visibleWidth should return length", () => {
      const text = "hello";
      const result = visibleWidth(text);
      expect(result).toBe(5);
    });
  });

  describe("given emoji", () => {
    it("then visibleWidth should count emoji as one", () => {
      const text = "😀";
      const result = visibleWidth(text);
      expect(result).toBe(1);
    });
  });

  describe("given emoji and text", () => {
    it("then visibleWidth should count correctly", () => {
      const text = "😀hello";
      const result = visibleWidth(text);
      expect(result).toBe(6);
    });
  });
});
