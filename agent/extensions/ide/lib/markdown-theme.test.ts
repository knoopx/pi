import { describe, it, expect, vi } from "vitest";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { createMarkdownTheme } from "./markdown-theme";
import { formatRelativeTime } from "../lib/formatters";
import { formatErrorMessage } from "./footer";

describe("formatRelativeTime", () => {
  describe("given a date within the last hour", () => {
    const cases = [
      { minutesAgo: 0, expected: "0m ago" },
      { minutesAgo: 1, expected: "1m ago" },
      { minutesAgo: 30, expected: "30m ago" },
      { minutesAgo: 59, expected: "59m ago" },
    ];
    cases.forEach(({ minutesAgo, expected }) => {
      describe(`when ${minutesAgo} minutes ago`, () => {
        it(`then returns "${expected}"`, () => {
          const now = new Date("2024-01-15T12:00:00Z");
          const past = new Date(now.getTime() - minutesAgo * 60_000);
          vi.setSystemTime(now);
          expect(formatRelativeTime(past.toISOString())).toBe(expected);
        });
      });
    });
  });
  describe("given a date within the last day", () => {
    const cases = [
      { hoursAgo: 1, expected: "1h ago" },
      { hoursAgo: 12, expected: "12h ago" },
      { hoursAgo: 23, expected: "23h ago" },
    ];
    cases.forEach(({ hoursAgo, expected }) => {
      describe(`when ${hoursAgo} hours ago`, () => {
        it(`then returns "${expected}"`, () => {
          const now = new Date("2024-01-15T12:00:00Z");
          const past = new Date(now.getTime() - hoursAgo * 60 * 60_000);
          vi.setSystemTime(now);
          expect(formatRelativeTime(past.toISOString())).toBe(expected);
        });
      });
    });
  });
  describe("given a date within the last month", () => {
    const cases = [
      { daysAgo: 1, expected: "1d ago" },
      { daysAgo: 7, expected: "7d ago" },
      { daysAgo: 29, expected: "29d ago" },
    ];
    cases.forEach(({ daysAgo, expected }) => {
      describe(`when ${daysAgo} days ago`, () => {
        it(`then returns "${expected}"`, () => {
          const now = new Date("2024-01-15T12:00:00Z");
          const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60_000);
          vi.setSystemTime(now);
          expect(formatRelativeTime(past.toISOString())).toBe(expected);
        });
      });
    });
  });
  describe("given a date older than 30 days", () => {
    describe("when 30+ days ago", () => {
      it("then returns locale date string", () => {
        const now = new Date("2024-01-15T12:00:00Z");
        vi.setSystemTime(now);
        const past = new Date("2023-12-01T12:00:00Z");
        const result = formatRelativeTime(past.toISOString());
        expect(result).not.toContain("ago");
        expect(result).toMatch(/\d/);
      });
    });
  });
});
describe("formatErrorMessage", () => {
  describe("given an Error object", () => {
    describe("when formatting", () => {
      it("then returns the error message", () => {
        const error = new Error("Something went wrong");
        expect(formatErrorMessage(error)).toBe("Something went wrong");
      });
    });
  });
  describe("given a string", () => {
    describe("when formatting", () => {
      it("then returns the string directly", () => {
        expect(formatErrorMessage("Plain error")).toBe("Plain error");
      });
    });
  });
  describe("given a number", () => {
    describe("when formatting", () => {
      it("then returns string representation", () => {
        expect(formatErrorMessage(404)).toBe("404");
      });
    });
  });
  describe("given null or undefined", () => {
    describe("when formatting", () => {
      it("then returns string representation", () => {
        expect(formatErrorMessage(null)).toBe("null");
        expect(formatErrorMessage(undefined)).toBe("undefined");
      });
    });
  });
  describe("given an object", () => {
    describe("when formatting", () => {
      it("then returns object string representation", () => {
        expect(formatErrorMessage({ code: 500 })).toBe("[object Object]");
      });
    });
  });
});
describe("createMarkdownTheme", () => {
  describe("given a pi theme", () => {
    const mockTheme = {
      fg: (color: string, text: string) => `[${color}:${text}]`,
      bold: (text: string) => `**${text}**`,
      italic: (text: string) => `*${text}*`,
      strikethrough: (text: string) => `~~${text}~~`,
      underline: (text: string) => `_${text}_`,
    } as unknown as Theme;
    describe("when creating markdown theme", () => {
      it("then returns theme with all required properties", () => {
        const mdTheme = createMarkdownTheme(mockTheme);
        expect(mdTheme.heading).toBeDefined();
        expect(mdTheme.link).toBeDefined();
        expect(mdTheme.linkUrl).toBeDefined();
        expect(mdTheme.code).toBeDefined();
        expect(mdTheme.codeBlock).toBeDefined();
        expect(mdTheme.codeBlockBorder).toBeDefined();
        expect(mdTheme.quote).toBeDefined();
        expect(mdTheme.quoteBorder).toBeDefined();
        expect(mdTheme.hr).toBeDefined();
        expect(mdTheme.listBullet).toBeDefined();
        expect(mdTheme.bold).toBeDefined();
        expect(mdTheme.italic).toBeDefined();
        expect(mdTheme.strikethrough).toBeDefined();
        expect(mdTheme.underline).toBeDefined();
      });
      it("then heading applies color and bold", () => {
        const mdTheme = createMarkdownTheme(mockTheme);
        expect(mdTheme.heading("Title")).toBe("[mdHeading:**Title**]");
      });
      it("then bold uses theme bold", () => {
        const mdTheme = createMarkdownTheme(mockTheme);
        expect(mdTheme.bold("text")).toBe("**text**");
      });
      it("then italic uses theme italic", () => {
        const mdTheme = createMarkdownTheme(mockTheme);
        expect(mdTheme.italic("text")).toBe("*text*");
      });
    });
  });
});
