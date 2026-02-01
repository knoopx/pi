import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// import type { Database } from "better-sqlite3";
import {
  levenshteinDistance,
  similarityScore,
  extractDomain,
  getFirefoxProfilePath,
  getBookmarksFromDB,
} from "./index";

// Mock better-sqlite3
vi.mock("better-sqlite3", () => ({
  default: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  copyFile: vi.fn(),
}));

describe("Bookmarks Extension", () => {
  describe("given levenshteinDistance function", () => {
    describe("when calculating distance between identical strings", () => {
      it("then returns 0", () => {
        expect(levenshteinDistance("test", "test")).toBe(0);
      });
    });

    describe("when calculating distance between different strings", () => {
      it("then returns correct distance", () => {
        expect(levenshteinDistance("kitten", "sitting")).toBe(3);
        expect(levenshteinDistance("", "a")).toBe(1);
        expect(levenshteinDistance("a", "")).toBe(1);
        expect(levenshteinDistance("abc", "def")).toBe(3);
      });
    });

    describe("when one string is empty", () => {
      it("then returns length of other string", () => {
        expect(levenshteinDistance("", "hello")).toBe(5);
        expect(levenshteinDistance("world", "")).toBe(5);
      });
    });
  });

  describe("given similarityScore function", () => {
    describe("when strings are identical", () => {
      it("then returns 1", () => {
        expect(similarityScore("test", "test")).toBe(1);
      });
    });

    describe("when strings are completely different", () => {
      it("then returns 0", () => {
        expect(similarityScore("abc", "def")).toBeCloseTo(0, 2);
      });
    });

    describe("when strings are similar", () => {
      it("then returns appropriate similarity", () => {
        expect(similarityScore("kitten", "sitting")).toBeCloseTo(0.571, 3);
        expect(similarityScore("test", "best")).toBe(0.75);
      });
    });

    describe("when both strings are empty", () => {
      it("then returns 1", () => {
        expect(similarityScore("", "")).toBe(1);
      });
    });
  });

  describe("given extractDomain function", () => {
    describe("when valid URL provided", () => {
      it("then returns hostname", () => {
        expect(extractDomain("https://www.example.com/path")).toBe(
          "www.example.com",
        );
        expect(extractDomain("http://github.com/user/repo")).toBe("github.com");
      });
    });

    describe("when URL without protocol", () => {
      it("then returns empty string", () => {
        expect(extractDomain("example.com")).toBe("");
      });
    });

    describe("when invalid URL", () => {
      it("then returns empty string", () => {
        expect(extractDomain("not-a-url")).toBe("");
        expect(extractDomain("")).toBe("");
      });
    });
  });

  describe("given getFirefoxProfilePath function", () => {
    describe("when called", () => {
      it("then returns expected profile path", () => {
        const expected = "/home/knoopx/.mozilla/firefox/knoopx/places.sqlite";
        expect(getFirefoxProfilePath()).toBe(expected);
      });
    });
  });

  describe("given getBookmarksFromDB function", () => {
    let mockDb: any;
    let mockPrepare: any;
    let mockAll: any;

    beforeEach(async () => {
      mockAll = vi.fn();
      mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
      mockDb = {
        prepare: mockPrepare,
        close: vi.fn(),
        pragma: vi.fn(),
      };

      const sqlite3 = await import("better-sqlite3");
      (sqlite3.default as any).mockReturnValue(mockDb);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe("when database file does not exist", () => {
      beforeEach(async () => {
        const fs = await import("fs/promises");
        (fs.access as any).mockRejectedValue(new Error("File not found"));
      });

      describe("when called", () => {
        it("then throws error", async () => {
          await expect(getBookmarksFromDB("test")).rejects.toThrow(
            "Firefox database not found",
          );
        });
      });
    });

    describe("when database file exists", () => {
      beforeEach(async () => {
        const fs = await import("fs/promises");
        (fs.access as any).mockResolvedValue(undefined);
        (fs.copyFile as any).mockResolvedValue(undefined);
      });

      describe("when no query provided", () => {
        beforeEach(() => {
          mockAll.mockReturnValue([
            {
              id: 1,
              url: "https://example.com",
              title: "Example",
              dateAdded: 1234567890,
            },
            {
              id: 2,
              url: "https://test.com",
              title: "Test",
              dateAdded: 1234567891,
            },
          ]);
        });

        describe("when called", () => {
          it("then returns all bookmarks", async () => {
            const result = await getBookmarksFromDB();
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
              id: "1",
              title: "Example",
              url: "https://example.com",
              domain: "example.com",
            });
            expect(result[1]).toMatchObject({
              id: "2",
              title: "Test",
              url: "https://test.com",
              domain: "test.com",
            });
          });
        });
      });

      describe("when query provided", () => {
        beforeEach(() => {
          mockAll.mockReturnValue([
            {
              id: 1,
              url: "https://github.com",
              title: "GitHub",
              dateAdded: 1234567890,
            },
            {
              id: 2,
              url: "https://gitlab.com",
              title: "GitLab",
              dateAdded: 1234567891,
            },
            {
              id: 3,
              url: "https://example.com",
              title: "Example",
              dateAdded: 1234567892,
            },
          ]);
        });

        describe("when searching for 'github'", () => {
          it("then returns similar bookmarks sorted by similarity", async () => {
            const result = await getBookmarksFromDB("github");
            expect(result).toHaveLength(2);
            expect(result[0].title).toBe("GitHub");
            expect(result[1].title).toBe("GitLab");
            expect(result[0].similarity!).toBeGreaterThan(
              result[1].similarity!,
            );
          });
        });

        describe("when searching for non-matching query", () => {
          it("then returns empty array", async () => {
            const result = await getBookmarksFromDB("xyz");
            expect(result).toHaveLength(0);
          });
        });
      });

      describe("when database query fails", () => {
        beforeEach(() => {
          mockAll.mockImplementation(() => {
            throw new Error("Database error");
          });
        });

        describe("when called", () => {
          it("then throws error", async () => {
            await expect(getBookmarksFromDB()).rejects.toThrow(
              "Database error",
            );
          });
        });
      });
    });
  });

  describe("given extension default function", () => {
    let mockPi: any;

    beforeEach(() => {
      mockPi = {
        registerTool: vi.fn(),
      };
    });

    describe("when extension is loaded", () => {
      it("then registers search-bookmarks tool", async () => {
        const { default: bookmarksExtension } = await import("./index");
        bookmarksExtension(mockPi);

        expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
        expect(mockPi.registerTool).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "search-bookmarks",
            label: "Search Bookmarks",
          }),
        );
      });
    });
  });
});
