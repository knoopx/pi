import { describe, it, expect } from "vitest";
import { UsageComponent } from "./component";
import { emptyTimeFilteredStats, type UsageData } from "./types";
import { createMockTheme } from "../../ide/lib/test-utils";

function createMockUsageData(): UsageData {
  return {
    today: {
      providers: new Map([
        [
          "Anthropic",
          {
            sessions: new Set(["session-1"]),
            messages: 5,
            cost: 0.025,
            tokens: { total: 12000, input: 8000, output: 4000, cache: 0 },
            models: new Map([
              [
                "claude-sonnet-4-20250514",
                {
                  sessions: new Set(["session-1"]),
                  messages: 5,
                  cost: 0.025,
                  tokens: { total: 12000, input: 8000, output: 4000, cache: 0 },
                },
              ],
            ]),
          },
        ],
        [
          "OpenAI",
          {
            sessions: new Set(["session-2"]),
            messages: 3,
            cost: 0.01,
            tokens: { total: 5000, input: 3000, output: 2000, cache: 0 },
            models: new Map([
              [
                "gpt-4o",
                {
                  sessions: new Set(["session-2"]),
                  messages: 3,
                  cost: 0.01,
                  tokens: { total: 5000, input: 3000, output: 2000, cache: 0 },
                },
              ],
            ]),
          },
        ],
      ]),
      totals: {
        sessions: 2,
        messages: 8,
        cost: 0.035,
        tokens: { total: 17000, input: 11000, output: 6000, cache: 0 },
      },
    },
    thisWeek: {
      providers: new Map([
        [
          "Anthropic",
          {
            sessions: new Set(["session-1", "session-3"]),
            messages: 25,
            cost: 0.12,
            tokens: { total: 60000, input: 40000, output: 20000, cache: 0 },
            models: new Map([
              [
                "claude-sonnet-4-20250514",
                {
                  sessions: new Set(["session-1", "session-3"]),
                  messages: 25,
                  cost: 0.12,
                  tokens: {
                    total: 60000,
                    input: 40000,
                    output: 20000,
                    cache: 0,
                  },
                },
              ],
            ]),
          },
        ],
      ]),
      totals: {
        sessions: 5,
        messages: 30,
        cost: 0.14,
        tokens: { total: 70000, input: 45000, output: 25000, cache: 0 },
      },
    },
    allTime: {
      providers: new Map([
        [
          "Anthropic",
          {
            sessions: new Set(["session-1"]),
            messages: 100,
            cost: 0.5,
            tokens: { total: 250000, input: 170000, output: 80000, cache: 0 },
            models: new Map([
              [
                "claude-sonnet-4-20250514",
                {
                  sessions: new Set(["session-1"]),
                  messages: 100,
                  cost: 0.5,
                  tokens: {
                    total: 250000,
                    input: 170000,
                    output: 80000,
                    cache: 0,
                  },
                },
              ],
            ]),
          },
        ],
      ]),
      totals: {
        sessions: 20,
        messages: 120,
        cost: 0.55,
        tokens: { total: 300000, input: 200000, output: 100000, cache: 0 },
      },
    },
  };
}

describe("usage component rendering", () => {
  it("renders usage dashboard with provider data and totals", () => {
    const theme = createMockTheme();
    const data = createMockUsageData();
    const component = new UsageComponent(
      theme,
      data,
      () => {},
      () => {},
    );
    const lines = component.render();
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("renders 'This Week' tab with week totals", () => {
    const theme = createMockTheme();
    const data = createMockUsageData();
    const component = new UsageComponent(
      theme,
      data,
      () => {},
      () => {},
    );
    component.handleInput("\t"); // cycle to This Week
    const lines = component.render();
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("renders empty usage when no providers", () => {
    const theme = createMockTheme();
    const data: UsageData = {
      today: emptyTimeFilteredStats(),
      thisWeek: emptyTimeFilteredStats(),
      allTime: emptyTimeFilteredStats(),
    };
    const component = new UsageComponent(
      theme,
      data,
      () => {},
      () => {},
    );
    const lines = component.render();
    expect(lines.join("\n")).toMatchSnapshot();
  });
});
