/**
 * Unit Tests for Usage Statistics Module
 *
 * Tests cover:
 * - Pure formatting functions (no I/O)
 * - UsageComponent UI logic
 * - Data aggregation logic (with mocked data sources)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  getSessionsDir,
  UsageComponent,
  formatCost,
  formatTokens,
  formatNumber,
  padLeft,
  padRight,
  type UsageData,
} from "./index";

// =============================================================================
// Helper Functions
// =============================================================================

function createMockUsageData(): UsageData {
  return {
    today: {
      providers: new Map([
        [
          "provider1",
          {
            sessions: new Set(["session1"]),
            messages: 2,
            cost: 0.001,
            tokens: { total: 100, input: 60, output: 40, cache: 0 },
            models: new Map<
              string,
              {
                sessions: Set<string>;
                messages: number;
                cost: number;
                tokens: {
                  total: number;
                  input: number;
                  output: number;
                  cache: number;
                };
              }
            >([
              [
                "model1",
                {
                  sessions: new Set(["session1"]),
                  messages: 2,
                  cost: 0.001,
                  tokens: { total: 100, input: 60, output: 40, cache: 0 },
                },
              ],
            ]),
          },
        ],
      ]),
      totals: {
        sessions: 1,
        messages: 2,
        cost: 0.001,
        tokens: { total: 100, input: 60, output: 40, cache: 0 },
      },
    },
    thisWeek: {
      providers: new Map(),
      totals: {
        sessions: 0,
        messages: 0,
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, cache: 0 },
      },
    },
    allTime: {
      providers: new Map(),
      totals: {
        sessions: 0,
        messages: 0,
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, cache: 0 },
      },
    },
  };
}

// Mock Theme object
const mockTheme = {
  fg: (_name: string, text: string) => text,
  bold: (text: string) => text,
} as Theme;

// =============================================================================
// Session Directory Tests
// =============================================================================

describe("getSessionsDir", () => {
  const originalEnv = process.env.PI_CODING_AGENT_DIR;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalEnv;
    }
  });

  describe("when PI_CODING_AGENT_DIR is set", () => {
    it("then returns path with custom agent directory", () => {
      process.env.PI_CODING_AGENT_DIR = "/custom/agent/dir";
      const result = getSessionsDir();
      expect(result).toBe("/custom/agent/dir/sessions");
    });
  });

  describe("when PI_CODING_AGENT_DIR is not set", () => {
    it("then returns default home directory path", () => {
      delete process.env.PI_CODING_AGENT_DIR;
      const result = getSessionsDir();
      expect(result).toContain(".pi/agent/sessions");
    });
  });
});

// =============================================================================
// Formatting Functions Tests
// =============================================================================

describe("formatCost", () => {
  describe("when cost is zero", () => {
    it("then returns '-'", () => {
      expect(formatCost(0)).toBe("-");
    });
  });

  describe("when cost is very small (< 0.01)", () => {
    it("then returns formatted with 4 decimal places", () => {
      expect(formatCost(0.0001)).toBe("$0.0001");
      expect(formatCost(0.0099)).toBe("$0.0099");
    });
  });

  describe("when cost is small (< 1)", () => {
    it("then returns formatted with 2 decimal places", () => {
      expect(formatCost(0.01)).toBe("$0.01");
      expect(formatCost(0.99)).toBe("$0.99");
    });
  });

  describe("when cost is moderate (< 10)", () => {
    it("then returns formatted with 2 decimal places", () => {
      expect(formatCost(1.0)).toBe("$1.00");
      expect(formatCost(9.99)).toBe("$9.99");
    });
  });

  describe("when cost is large (< 100)", () => {
    it("then returns formatted with 1 decimal place", () => {
      expect(formatCost(10.0)).toBe("$10.0");
      expect(formatCost(99.99)).toBe("$99.9");
    });
  });

  describe("when cost is very large", () => {
    it("then returns rounded to integer", () => {
      expect(formatCost(100.0)).toBe("$100");
      expect(formatCost(999.99)).toBe("$1000");
    });
  });
});

describe("formatTokens", () => {
  describe("when count is zero", () => {
    it("then returns '-'", () => {
      expect(formatTokens(0)).toBe("-");
    });
  });

  describe("when count is less than 1000", () => {
    it("then returns as integer", () => {
      expect(formatTokens(1)).toBe("1");
      expect(formatTokens(999)).toBe("999");
    });
  });

  describe("when count is between 1000 and 10000", () => {
    it("then returns with 1 decimal place", () => {
      expect(formatTokens(1000)).toBe("1.0k");
      expect(formatTokens(5000)).toBe("5.0k");
      expect(formatTokens(9999)).toBe("9.9k");
    });
  });

  describe("when count is between 10000 and 1000000", () => {
    it("then returns as integer kilo", () => {
      expect(formatTokens(10000)).toBe("10k");
      expect(formatTokens(100000)).toBe("100k");
      expect(formatTokens(999999)).toBe("1000k");
    });
  });

  describe("when count is between 1000000 and 10000000", () => {
    it("then returns with 1 decimal place mega", () => {
      expect(formatTokens(1000000)).toBe("1.0M");
      expect(formatTokens(5000000)).toBe("5.0M");
      expect(formatTokens(9999999)).toBe("10.0M");
    });
  });

  describe("when count is very large", () => {
    it("then returns rounded to integer mega", () => {
      expect(formatTokens(10000000)).toBe("10M");
      expect(formatTokens(99999999)).toBe("100M");
    });
  });
});

describe("formatNumber", () => {
  describe("when number is zero", () => {
    it("then returns '-'", () => {
      expect(formatNumber(0)).toBe("-");
    });
  });

  describe("when number is positive", () => {
    it("then returns localized number with commas", () => {
      expect(formatNumber(1)).toBe("1");
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(1000000)).toBe("1,000,000");
    });
  });
});

describe("padLeft", () => {
  describe("when string fits in width", () => {
    it("then returns string unchanged", () => {
      expect(padLeft("hello", 5)).toBe("hello");
    });
  });

  describe("when string is shorter than width", () => {
    it("then pads with spaces on left", () => {
      expect(padLeft("hello", 10)).toBe("     hello");
    });
  });

  describe("when string is longer than width", () => {
    it("then returns string unchanged", () => {
      expect(padLeft("hello", 3)).toBe("hello");
    });
  });
});

describe("padRight", () => {
  describe("when string fits in width", () => {
    it("then returns string unchanged", () => {
      expect(padRight("hello", 5)).toBe("hello");
    });
  });

  describe("when string is shorter than width", () => {
    it("then pads with spaces on right", () => {
      expect(padRight("hello", 10)).toBe("hello     ");
    });
  });

  describe("when string is longer than width", () => {
    it("then returns string unchanged", () => {
      expect(padRight("hello", 3)).toBe("hello");
    });
  });
});

// =============================================================================
// Usage Component Tests
// =============================================================================

describe("UsageComponent", () => {
  let component: UsageComponent;
  let mockData: UsageData;
  let mockRequestRender: ReturnType<typeof vi.fn>;
  let mockDone: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRequestRender = vi.fn();
    mockDone = vi.fn();
    mockData = createMockUsageData();

    component = new UsageComponent(
      mockTheme,
      mockData,
      mockRequestRender as () => void,
      mockDone as () => void,
    );
  });

  describe("constructor", () => {
    it("then initializes with provided data", () => {
      expect(component).toBeInstanceOf(UsageComponent);
    });
  });

  describe("updateProviderOrder", () => {
    it("then filters providers with zero usage", () => {
      const emptyProviderStats = {
        sessions: new Set<string>(),
        messages: 0,
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, cache: 0 },
        models: new Map(),
      };

      mockData.today.providers.set("zero-usage-provider", emptyProviderStats);

      // @ts-expect-error - accessing private method for testing
      component.updateProviderOrder();

      // @ts-expect-error - accessing private property for testing
      expect(component.providerOrder).not.toContain("zero-usage-provider");
    });

    it("then sorts providers by cost descending", () => {
      mockData.today.providers.set("provider2", {
        sessions: new Set(["session2"]),
        messages: 1,
        cost: 0.01, // Higher cost
        tokens: { total: 1000, input: 600, output: 400, cache: 0 },
        models: new Map(),
      });

      // @ts-expect-error - accessing private method for testing
      component.updateProviderOrder();

      // @ts-expect-error - accessing private property for testing
      expect(component.providerOrder[0]).toBe("provider2");
      // @ts-expect-error - accessing private property for testing
      expect(component.providerOrder[1]).toBe("provider1");
    });
  });

  describe("handleInput - Tab navigation", () => {
    it("then cycles to next tab with tab key", () => {
      component["activeTab"] = "today";

      component.handleInput("tab");

      expect(component["activeTab"]).toBe("thisWeek");
    });

    it("then cycles to next tab with right arrow", () => {
      component["activeTab"] = "today";

      component.handleInput("right");

      expect(component["activeTab"]).toBe("thisWeek");
    });

    it("then cycles to first tab from last tab", () => {
      component["activeTab"] = "allTime";

      component.handleInput("tab");

      expect(component["activeTab"]).toBe("today");
    });

    it("then cycles to previous tab with shift+tab", () => {
      component["activeTab"] = "allTime";

      component.handleInput("shift+tab");

      expect(component["activeTab"]).toBe("thisWeek");
    });

    it("then cycles to previous tab with left arrow", () => {
      component["activeTab"] = "allTime";

      component.handleInput("left");

      expect(component["activeTab"]).toBe("thisWeek");
    });

    it("then requests render on tab change", () => {
      component["activeTab"] = "today";
      mockRequestRender.mockClear();

      component.handleInput("tab");

      expect(mockRequestRender).toHaveBeenCalled();
    });
  });

  describe("handleInput - Provider selection", () => {
    it("then moves selection up with up arrow", () => {
      component["selectedIndex"] = 1;
      component["providerOrder"] = ["provider1", "provider2", "provider3"];

      component.handleInput("up");

      expect(component["selectedIndex"]).toBe(0);
    });

    it("then moves selection down with down arrow", () => {
      component["selectedIndex"] = 0;
      component["providerOrder"] = ["provider1", "provider2", "provider3"];

      component.handleInput("down");

      expect(component["selectedIndex"]).toBe(1);
    });

    it("then prevents selection from going below zero", () => {
      component["selectedIndex"] = 0;
      component["providerOrder"] = ["provider1", "provider2", "provider3"];

      component.handleInput("up");

      expect(component["selectedIndex"]).toBe(0);
    });

    it("then prevents selection from going above last index", () => {
      component["selectedIndex"] = 2;
      component["providerOrder"] = ["provider1", "provider2", "provider3"];

      component.handleInput("down");

      expect(component["selectedIndex"]).toBe(2);
    });
  });

  describe("handleInput - Expand/Collapse", () => {
    it("then expands provider with enter key", () => {
      const provider = "provider1";
      component["providerOrder"] = [provider];
      component["selectedIndex"] = 0;

      component.handleInput("enter");

      expect(component["expanded"].has(provider)).toBe(true);
    });

    it("then collapses provider with space key", () => {
      const provider = "provider1";
      component["providerOrder"] = [provider];
      component["selectedIndex"] = 0;
      component["expanded"].add(provider);

      component.handleInput("space");

      expect(component["expanded"].has(provider)).toBe(false);
    });

    it("then toggles state on repeated enter", () => {
      const provider = "provider1";
      component["providerOrder"] = [provider];
      component["selectedIndex"] = 0;

      component.handleInput("enter"); // Expand
      component.handleInput("enter"); // Collapse

      expect(component["expanded"].has(provider)).toBe(false);
    });
  });

  describe("handleInput - Close", () => {
    it("then calls done with escape key", () => {
      component.handleInput("escape");

      expect(mockDone).toHaveBeenCalled();
    });

    it("then calls done with q key", () => {
      component.handleInput("q");

      expect(mockDone).toHaveBeenCalled();
    });

    it("then does not request render on close", () => {
      mockRequestRender.mockClear();

      component.handleInput("escape");

      expect(mockRequestRender).not.toHaveBeenCalled();
    });
  });

  describe("handleInput - Unknown keys", () => {
    it("then ignores unknown keys without throwing", () => {
      expect(() => {
        component.handleInput("x");
      }).not.toThrow();
    });

    it("then does not change active state with unknown keys", () => {
      const initialTab = component["activeTab"];
      const initialIndex = component["selectedIndex"];

      component.handleInput("x");

      expect(component["activeTab"]).toBe(initialTab);
      expect(component["selectedIndex"]).toBe(initialIndex);
    });
  });

  describe("render - Empty data", () => {
    it("then renders empty state message", () => {
      const emptyData = {
        today: {
          providers: new Map(),
          totals: {
            sessions: 0,
            messages: 0,
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, cache: 0 },
          },
        },
        thisWeek: {
          providers: new Map(),
          totals: {
            sessions: 0,
            messages: 0,
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, cache: 0 },
          },
        },
        allTime: {
          providers: new Map(),
          totals: {
            sessions: 0,
            messages: 0,
            cost: 0,
            tokens: { total: 0, input: 0, output: 0, cache: 0 },
          },
        },
      };

      const emptyComponent = new UsageComponent(
        mockTheme,
        emptyData,
        mockRequestRender as () => void,
        mockDone as () => void,
      );

      const lines = emptyComponent.render(80);

      expect(lines.some((line) => line.includes("No usage data"))).toBe(true);
    });
  });

  describe("render - With data", () => {
    it("then renders provider rows", () => {
      const lines = component.render(80);

      expect(lines.some((line) => line.includes("provider1"))).toBe(true);
    });

    it("then renders totals row", () => {
      const lines = component.render(80);

      expect(lines.some((line) => line.includes("Total"))).toBe(true);
    });

    it("then renders help text", () => {
      const lines = component.render(80);

      expect(
        lines.some(
          (line) =>
            line.includes("Tab") || line.includes("↑↓") || line.includes("q"),
        ),
      ).toBe(true);
    });
  });

  describe("render - Expanded provider", () => {
    it("then shows models when expanded", () => {
      component["providerOrder"] = ["provider1"];
      component["selectedIndex"] = 0;
      component["expanded"].add("provider1");

      const lines = component.render(80);

      expect(lines.some((line) => line.includes("model1"))).toBe(true);
    });
  });
});
