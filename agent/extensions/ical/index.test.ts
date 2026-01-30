/**
 * Unit Tests for iCal Extension
 * Tests: Configuration, caching, relative date parsing, and iCal sanitization
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseRelativeDate,
  parseDateInput,
  sanitizeIcs,
  saveCache,
  loadCache,
  clearCache,
  getCachePath,
  saveCalendars,
  loadCalendars,
  loadStore,
  CalendarConfig,
} from "./index";
import { CalendarResponse } from "node-ical";

// Test utilities
const TEST_AUTH_PATH = path.join(
  os.homedir(),
  ".pi",
  "agent",
  "auth.test.json",
);
const TEST_CACHE_DIR = path.join(
  os.homedir(),
  ".cache",
  "pi",
  "agent",
  "extensions",
  "ical",
  "test",
);

// ============================================================================
// Configuration Management Tests
// ============================================================================

describe("Configuration Management", () => {
  beforeEach(() => {
    // Create test auth file
    if (!fs.existsSync(TEST_AUTH_PATH)) {
      fs.mkdirSync(path.dirname(TEST_AUTH_PATH), { recursive: true });
      fs.writeFileSync(TEST_AUTH_PATH, "{}");
    }
  });

  afterEach(() => {
    // Clean up test auth file
    if (fs.existsSync(TEST_AUTH_PATH)) {
      fs.unlinkSync(TEST_AUTH_PATH);
    }
  });

  describe("given a valid configuration", () => {
    describe("when saving calendars", () => {
      it("then it should persist calendars", () => {
        const calendars = [
          { name: "Personal", url: "https://cal1.ics" },
          { name: "Work", url: "https://cal2.ics" },
        ];
        saveCalendars(calendars, TEST_AUTH_PATH);
        const loaded = loadCalendars(TEST_AUTH_PATH);
        expect(loaded).toHaveLength(2);
        expect(loaded[0].name).toBe("Personal");
        expect(loaded[1].url).toBe("https://cal2.ics");
      });

      it("then it should handle timezone", () => {
        const calendars: CalendarConfig[] = [];
        saveCalendars(calendars, TEST_AUTH_PATH, "America/New_York");
        const loaded = loadStore(TEST_AUTH_PATH);
        expect(loaded.timezone).toBe("America/New_York");
      });
    });
  });

  describe("given no configuration", () => {
    it("then loadCalendars should return empty array", () => {
      expect(loadCalendars(TEST_AUTH_PATH)).toHaveLength(0);
    });

    it("then loadStore should return empty store", () => {
      expect(loadStore(TEST_AUTH_PATH)).toEqual({ calendars: [] });
    });
  });
});

// ============================================================================
// Cache Management Tests
// ============================================================================

describe("Cache Management", () => {
  beforeEach(() => {
    // Create test cache directory
    if (!fs.existsSync(TEST_CACHE_DIR)) {
      fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(TEST_CACHE_DIR)) {
      fs.rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  describe("given a cached calendar", () => {
    it("then it should load from cache", () => {
      const mockData = {
        vcalendar: [{ vevent: [{ dtstart: "2024-01-01" }] }],
      } as unknown as CalendarResponse;
      saveCache(TEST_CACHE_DIR, "https://test.ics", mockData);

      const cached = loadCache(TEST_CACHE_DIR, "https://test.ics");
      expect(cached).toBeDefined();
      expect(cached?.data).toEqual(mockData);
    });

    it("then it should respect cache expiration", () => {
      const mockData = {
        vcalendar: [{ vevent: [{ dtstart: "2024-01-01" }] }],
      } as unknown as CalendarResponse;
      saveCache(TEST_CACHE_DIR, "https://test.ics", mockData);
      loadCache(TEST_CACHE_DIR, "https://test.ics"); // Load once to set timestamp

      // Simulate cache expiration by modifying timestamp
      const cachePath = getCachePath(TEST_CACHE_DIR, "https://test.ics");
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      cached.fetchedAt = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      fs.writeFileSync(cachePath, JSON.stringify(cached));

      const expired = loadCache(TEST_CACHE_DIR, "https://test.ics");
      expect(expired).toBeNull();
    });

    it("then it should clear cache", () => {
      const mockData = {
        vcalendar: [{ vevent: [{ dtstart: "2024-01-01" }] }],
      } as unknown as CalendarResponse;
      saveCache(TEST_CACHE_DIR, "https://test.ics", mockData);
      clearCache(TEST_CACHE_DIR, "https://test.ics");

      const cached = loadCache(TEST_CACHE_DIR, "https://test.ics");
      expect(cached).toBeNull();
    });
  });
});

// ============================================================================
// Relative Date Parsing Tests
// ============================================================================

describe("Relative Date Parsing", () => {
  describe("given today", () => {
    it("then parseRelativeDate should return today", () => {
      const result = parseRelativeDate("today", "Europe/Madrid");
      expect(result).toBeDefined();
      expect(result?.getDate()).toBe(new Date().getDate());
    });
  });

  describe("given tomorrow", () => {
    it("then parseRelativeDate should return tomorrow", () => {
      const result = parseRelativeDate("tomorrow", "Europe/Madrid");
      expect(result).toBeDefined();
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      expect(result?.getDate()).toBe(tomorrow.getDate());
    });
  });

  describe("given yesterday", () => {
    it("then parseRelativeDate should return yesterday", () => {
      const result = parseRelativeDate("yesterday", "Europe/Madrid");
      expect(result).toBeDefined();
      expect(result?.getDate()).toBe(new Date().getDate() - 1);
    });
  });

  describe("given this week", () => {
    it("then parseRelativeDate should return start of week", () => {
      const result = parseRelativeDate("this week", "Europe/Madrid");
      expect(result).toBeDefined();
      // Should be Monday
      expect(result?.getDay()).toBe(1);
    });
  });

  describe("given next week", () => {
    it("then parseRelativeDate should return start of next week", () => {
      const result = parseRelativeDate("next week", "Europe/Madrid");
      expect(result).toBeDefined();
      // Should be Monday of next week
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      const expected = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      expect(result?.getDate()).toBe(expected.getDate());
    });
  });
});

// ============================================================================
// Date Parsing Tests
// ============================================================================

describe("Date Parsing", () => {
  describe("given an ISO date", () => {
    it("then parseDateInput should parse it", () => {
      const result = parseDateInput("2024-01-01", "Europe/Madrid");
      expect(result).toBeDefined();
      expect(result?.getFullYear()).toBe(2024);
    });
  });

  describe("given a relative date", () => {
    it("then parseDateInput should parse it", () => {
      const result = parseDateInput("tomorrow", "Europe/Madrid");
      expect(result).toBeDefined();
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      expect(result?.getDate()).toBe(tomorrow.getDate());
    });
  });

  describe("given an undefined input", () => {
    it("then parseDateInput should return default date", () => {
      const result = parseDateInput(undefined, "Europe/Madrid");
      expect(result).toBeDefined();
      expect(result?.getTime()).toBe(new Date().getTime());
    });
  });
});

// ============================================================================
// iCal Sanitization Tests
// ============================================================================

describe("iCal Sanitization", () => {
  describe("given multi-line values", () => {
    it("then sanitizeIcs should combine continuation lines", () => {
      const input = `BEGIN:VEVENT
SUMMARY:Test Event
DESCRIPTION:This is a description
 that spans multiple lines
END:VEVENT`;
      const result = sanitizeIcs(input);
      expect(result).toContain(
        "This is a descriptionthat spans multiple lines",
      );
    });

    it("then it should preserve single-line values", () => {
      const input = `BEGIN:VEVENT
SUMMARY:Test Event
DESCRIPTION:Single line
END:VEVENT`;
      const result = sanitizeIcs(input);
      expect(result).toContain("Single line");
    });
  });

  describe("given empty input", () => {
    it("then sanitizeIcs should return empty string", () => {
      const result = sanitizeIcs("");
      expect(result).toBe("");
    });
  });

  describe("given malformed iCal", () => {
    it("then sanitizeIcs should handle it gracefully", () => {
      const input = "BEGIN:VEVENT\nSUMMARY:Test\nEND:VEVENT\n\n\n";
      const result = sanitizeIcs(input);
      expect(result).toBeDefined();
    });
  });
});
