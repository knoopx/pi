/**
 * Turn Stats Extension Tests
 * Tests for duration formatting, token formatting, and cost formatting utilities.
 */

import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatTokens,
  formatInputOutputTokens,
  formatCost,
  formatSimpleOutput,
  formatTokensPerSecond,
} from "./index";

describe("formatDuration", () => {
  describe("given durations less than 1 second", () => {
    describe("when formatting 0.36 seconds", () => {
      it("then it should return '0.36s'", () => {
        expect(formatDuration(360)).toBe("0.36s");
      });
    });

    describe("when formatting 0.001 seconds", () => {
      it("then it should return '0.00s'", () => {
        expect(formatDuration(1)).toBe("0.00s");
      });
    });

    describe("when formatting 0.999 seconds", () => {
      it("then it should return '1.00s'", () => {
        expect(formatDuration(999)).toBe("1.00s");
      });
    });
  });

  describe("given durations between 1 and 60 seconds", () => {
    describe("when formatting 36 seconds", () => {
      it("then it should return '36s'", () => {
        expect(formatDuration(36000)).toBe("36s");
      });
    });

    describe("when formatting 1 minute 32 seconds", () => {
      it("then it should return '1m 32s'", () => {
        expect(formatDuration(92000)).toBe("1m 32s");
      });
    });

    describe("when formatting exactly 60 seconds", () => {
      it("then it should return '1m 0s'", () => {
        expect(formatDuration(60000)).toBe("1m 0s");
      });
    });
  });

  describe("given durations between 1 minute and 1 hour", () => {
    describe("when formatting 2 minutes 15 seconds", () => {
      it("then it should return '2m 15s'", () => {
        expect(formatDuration(135000)).toBe("2m 15s");
      });
    });

    describe("when formatting 30 minutes", () => {
      it("then it should return '30m 0s'", () => {
        expect(formatDuration(1800000)).toBe("30m 0s");
      });
    });
  });

  describe("given durations over 1 hour", () => {
    describe("when formatting 1 hour 2 minutes 30 seconds", () => {
      it("then it should return '1h 2m 5s'", () => {
        expect(formatDuration(3725000)).toBe("1h 2m 5s");
      });
    });

    describe("when formatting 2 hours 15 minutes 30 seconds", () => {
      it("then it should return '2h 15m 30s'", () => {
        expect(formatDuration(8130000)).toBe("2h 15m 30s");
      });
    });

    describe("when formatting 24 hours", () => {
      it("then it should return '24h 0m 0s'", () => {
        expect(formatDuration(86400000)).toBe("24h 0m 0s");
      });
    });
  });
});

describe("formatTokens", () => {
  describe("given token counts less than 1000", () => {
    describe("when formatting 0 tokens", () => {
      it("then it should return '0'", () => {
        expect(formatTokens(0)).toBe("0");
      });
    });

    describe("when formatting 42 tokens", () => {
      it("then it should return '42'", () => {
        expect(formatTokens(42)).toBe("42");
      });
    });

    describe("when formatting 999 tokens", () => {
      it("then it should return '999'", () => {
        expect(formatTokens(999)).toBe("999");
      });
    });
  });

  describe("given token counts between 1000 and 1000000", () => {
    describe("when formatting 1000 tokens", () => {
      it("then it should return '1.0K'", () => {
        expect(formatTokens(1000)).toBe("1.0K");
      });
    });

    describe("when formatting 1500 tokens", () => {
      it("then it should return '1.5K'", () => {
        expect(formatTokens(1500)).toBe("1.5K");
      });
    });

    describe("when formatting 1234 tokens", () => {
      it("then it should return '1.2K'", () => {
        expect(formatTokens(1234)).toBe("1.2K");
      });
    });

    describe("when formatting 9999 tokens", () => {
      it("then it should return '10.0K'", () => {
        expect(formatTokens(9999)).toBe("10.0K");
      });
    });

    describe("when formatting 100000 tokens", () => {
      it("then it should return '100.0K'", () => {
        expect(formatTokens(100000)).toBe("100.0K");
      });
    });
  });

  describe("given token counts over 1000000", () => {
    describe("when formatting 1500000 tokens (millions)", () => {
      it("then it should return '1.5M'", () => {
        expect(formatTokens(1500000)).toBe("1.5M");
      });
    });

    describe("when formatting 2500000 tokens (millions)", () => {
      it("then it should return '2.5M'", () => {
        expect(formatTokens(2500000)).toBe("2.5M");
      });
    });
  });

  describe("given undefined or null token values", () => {
    describe("when formatting undefined tokens", () => {
      it("then it should return 'N/A'", () => {
        expect(formatTokens(undefined)).toBe("N/A");
      });
    });

    describe("when formatting null tokens", () => {
      it("then it should return 'N/A'", () => {
        expect(formatTokens(null)).toBe("N/A");
      });
    });
  });
});

describe("formatInputOutputTokens", () => {
  describe("given only input and output tokens", () => {
    describe("when formatting input: 1000, output: 500", () => {
      it("then it should return '↑1.0K ↓500'", () => {
        expect(formatInputOutputTokens(1000, 500, undefined, undefined)).toBe(
          "↑1.0K ↓500",
        );
      });
    });

    describe("when formatting input: 1234, output: 567", () => {
      it("then it should return '↑1.2K ↓567'", () => {
        expect(formatInputOutputTokens(1234, 567, undefined, undefined)).toBe(
          "↑1.2K ↓567",
        );
      });
    });
  });

  describe("given input, output, and cache tokens", () => {
    describe("when formatting input: 1000, output: 500, cacheRead: 100, cacheWrite: 50", () => {
      it("then it should return '↑1.0K ↓500' (cache tokens not displayed)", () => {
        expect(formatInputOutputTokens(1000, 500, 100, 50)).toBe("↑1.0K ↓500");
      });
    });

    describe("when formatting input: 1234, output: 567, cacheRead: 89, cacheWrite: 12", () => {
      it("then it should return '↑1.2K ↓567' (cache tokens not displayed)", () => {
        expect(formatInputOutputTokens(1234, 567, 89, 12)).toBe("↑1.2K ↓567");
      });
    });
  });

  describe("given only cache tokens", () => {
    describe("when formatting cacheRead: 100, cacheWrite: 50", () => {
      it("then it should return '' (empty string when both input/output are undefined)", () => {
        expect(formatInputOutputTokens(undefined, undefined, 100, 50)).toBe("");
      });
    });
  });

  describe("given all undefined values", () => {
    describe("when formatting all undefined", () => {
      it("then it should return '' (empty string, no N/A)", () => {
        expect(
          formatInputOutputTokens(undefined, undefined, undefined, undefined),
        ).toBe("");
      });
    });
  });
});

describe("formatCost", () => {
  describe("given a cost object with total cost", () => {
    describe("when formatting total cost of $0.01", () => {
      it("then it should return '$0.01'", () => {
        expect(formatCost({ total: 0.01 })).toBe("$0.01");
      });
    });

    describe("when formatting total cost of $1.99", () => {
      it("then it should return '$1.99'", () => {
        expect(formatCost({ total: 1.99 })).toBe("$1.99");
      });
    });

    describe("when formatting total cost of $0", () => {
      it("then it should return empty string (cost not included when 0)", () => {
        expect(formatCost({ total: 0 })).toBe("");
      });
    });
  });

  describe("given a cost object with individual cost components", () => {
    describe("when formatting input: $0.01, output: $0.02, no cache", () => {
      it("then it should return '$0.03' (sum of components)", () => {
        expect(formatCost({ input: 0.01, output: 0.02 })).toBe("$0.03");
      });
    });

    describe("when formatting input: $0.01, output: $0.02, cacheRead: $0.005, cacheWrite: $0.003", () => {
      it("then it should return '$0.04' (sum of components, rounded)", () => {
        expect(
          formatCost({
            input: 0.01,
            output: 0.02,
            cacheRead: 0.005,
            cacheWrite: 0.003,
          }),
        ).toBe("$0.04");
      });
    });

    describe("when formatting all individual costs as $0", () => {
      it("then it should return empty string (cost not included when 0)", () => {
        expect(
          formatCost({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }),
        ).toBe("");
      });
    });
  });

  describe("given undefined or null cost objects", () => {
    describe("when formatting undefined cost", () => {
      it("then it should return empty string (cost not included)", () => {
        expect(formatCost(undefined)).toBe("");
      });
    });

    describe("when formatting null cost", () => {
      it("then it should return empty string (cost not included)", () => {
        expect(formatCost(null)).toBe("");
      });
    });
  });
});

describe("formatTokensPerSecond", () => {
  describe("given valid tokens and generation time", () => {
    describe("when formatting 1000 tokens in 10000ms (10s)", () => {
      it("then it should return '100.0 tok/s'", () => {
        expect(formatTokensPerSecond(1000, 10000)).toBe("100.0 tok/s");
      });
    });

    describe("when formatting 500 tokens in 2000ms (2s)", () => {
      it("then it should return '250.0 tok/s'", () => {
        expect(formatTokensPerSecond(500, 2000)).toBe("250.0 tok/s");
      });
    });

    describe("when formatting 1900 tokens in 36000ms (36s)", () => {
      it("then it should return '52.8 tok/s'", () => {
        expect(formatTokensPerSecond(1900, 36000)).toBe("52.8 tok/s");
      });
    });
  });

  describe("given undefined or invalid values", () => {
    describe("when tokens is undefined", () => {
      it("then it should return empty string", () => {
        expect(formatTokensPerSecond(undefined, 10000)).toBe("");
      });
    });

    describe("when generation time is undefined", () => {
      it("then it should return empty string", () => {
        expect(formatTokensPerSecond(1000, undefined)).toBe("");
      });
    });

    describe("when generation time is 0", () => {
      it("then it should return empty string", () => {
        expect(formatTokensPerSecond(1000, 0)).toBe("");
      });
    });

    describe("when generation time is negative", () => {
      it("then it should return empty string", () => {
        expect(formatTokensPerSecond(1000, -100)).toBe("");
      });
    });
  });
});

describe("formatSimpleOutput", () => {
  describe("given only output tokens and duration (no generation time)", () => {
    describe("when formatting output: 1900, duration: 36000ms (36s)", () => {
      it("then it should return '↓1.9K | 36s' (no tok/s without generation time)", () => {
        expect(formatSimpleOutput(1900, 36000, undefined)).toBe("↓1.9K | 36s");
      });
    });

    describe("when formatting output: 500, duration: 92000ms (1m 32s)", () => {
      it("then it should return '↓500 | 1m 32s' (no tok/s without generation time)", () => {
        expect(formatSimpleOutput(500, 92000, undefined)).toBe("↓500 | 1m 32s");
      });
    });
  });

  describe("given output tokens, duration, and generation time", () => {
    describe("when formatting output: 1900, duration: 36000ms, generation: 30000ms", () => {
      it("then it should return '↓1.9K | 36s | 63.3 tok/s'", () => {
        expect(formatSimpleOutput(1900, 36000, undefined, 30000)).toBe(
          "↓1.9K | 36s | 63.3 tok/s",
        );
      });
    });

    describe("when formatting output: 500, duration: 92000ms, generation: 80000ms", () => {
      it("then it should return '↓500 | 1m 32s | 6.3 tok/s'", () => {
        expect(formatSimpleOutput(500, 92000, undefined, 80000)).toBe(
          "↓500 | 1m 32s | 6.3 tok/s",
        );
      });
    });
  });

  describe("given output tokens, duration, generation time, and cost", () => {
    describe("when formatting output: 1900, duration: 36000ms, generation: 30000ms, total cost: $0.01", () => {
      it("then it should return '↓1.9K | 36s | 63.3 tok/s | $0.01'", () => {
        expect(formatSimpleOutput(1900, 36000, { total: 0.01 }, 30000)).toBe(
          "↓1.9K | 36s | 63.3 tok/s | $0.01",
        );
      });
    });

    describe("when formatting output: 500, duration: 92000ms, generation: 80000ms, individual costs", () => {
      it("then it should return '↓500 | 1m 32s | 6.3 tok/s | $0.01'", () => {
        expect(
          formatSimpleOutput(
            500,
            92000,
            { input: 0.005, output: 0.005 },
            80000,
          ),
        ).toBe("↓500 | 1m 32s | 6.3 tok/s | $0.01");
      });
    });

    describe("when formatting output: 1234, duration: 5000ms, generation: 4000ms, total cost: $0", () => {
      it("then it should return '↓1.2K | 5s | 308.5 tok/s' (cost not included when 0)", () => {
        expect(formatSimpleOutput(1234, 5000, { total: 0 }, 4000)).toBe(
          "↓1.2K | 5s | 308.5 tok/s",
        );
      });
    });
  });

  describe("given output tokens, duration, generation time with only cache costs", () => {
    describe("when cost rounds to $0.00", () => {
      it("then it should exclude cost from output", () => {
        expect(
          formatSimpleOutput(
            500,
            10000,
            {
              cacheRead: 0.001,
              cacheWrite: 0.002,
            },
            8000,
          ),
        ).toBe("↓500 | 10s | 62.5 tok/s");
      });
    });

    describe("when cost rounds to $0.01", () => {
      it("then it should include cost", () => {
        expect(
          formatSimpleOutput(
            500,
            10000,
            {
              cacheRead: 0.003,
              cacheWrite: 0.003,
            },
            8000,
          ),
        ).toBe("↓500 | 10s | 62.5 tok/s | $0.01");
      });
    });
  });

  describe("given undefined output tokens", () => {
    describe("when formatting undefined output, duration: 36000ms, cost: $0.01", () => {
      it("then it should return '↓N/A | 36s | $0.01'", () => {
        expect(formatSimpleOutput(undefined, 36000, { total: 0.01 })).toBe(
          "↓N/A | 36s | $0.01",
        );
      });
    });
  });
});

describe("Turn Stats Extension Integration", () => {
  /**
   * Integration test scenario: A complete turn with duration, tokens, generation time, and cost
   */
  describe("given a complete turn with all metrics", () => {
    const outputTokens = 1900;
    const durationMs = 36000;
    const generationMs = 30000; // Actual generation time (excludes TTFT)
    const cost = { input: 0.005, output: 0.005 };

    describe("when formatting the complete turn output", () => {
      it("then it should show tokens, duration, tok/s, and cost", () => {
        const result = formatSimpleOutput(
          outputTokens,
          durationMs,
          cost,
          generationMs,
        );
        expect(result).toBe("↓1.9K | 36s | 63.3 tok/s | $0.01");
      });
    });

    describe("when checking the individual components", () => {
      it("then output tokens should be formatted as '1.9K'", () => {
        const tokensPart = (result: string) => {
          const match = result.match(/↓([^|]+)/);
          return match ? match[1].trim() : null;
        };
        expect(tokensPart("↓1.9K | 36s | 63.3 tok/s | $0.01")).toBe("1.9K");
      });

      it("then duration should be formatted as '36s'", () => {
        const durationPart = (result: string) => {
          const match = result.match(/36s/);
          return match ? match[0] : null;
        };
        expect(durationPart("↓1.9K | 36s | 63.3 tok/s | $0.01")).toBe("36s");
      });

      it("then tok/s should be based on generation time, not duration", () => {
        // 1900 tokens / 30s = 63.3 tok/s (NOT 1900/36 = 52.8 tok/s)
        const tokPerSecPart = (result: string) => {
          const match = result.match(/(\d+\.\d+) tok\/s/);
          return match ? match[1] : null;
        };
        expect(tokPerSecPart("↓1.9K | 36s | 63.3 tok/s | $0.01")).toBe("63.3");
      });

      it("then cost should be formatted as '$0.01'", () => {
        const costPart = (result: string) => {
          const match = result.match(/\$[0-9.]+$/);
          return match ? match[0] : null;
        };
        expect(costPart("↓1.9K | 36s | 63.3 tok/s | $0.01")).toBe("$0.01");
      });
    });
  });

  /**
   * Integration test scenario: Multiple turns with generation time tracking
   */
  describe("given multiple turns in a session", () => {
    const turn1 = {
      output: 500,
      duration: 10000,
      generation: 8000,
      cost: { total: 0.001 },
    };
    const turn2 = {
      output: 1000,
      duration: 15000,
      generation: 12000,
      cost: { total: 0.002 },
    };
    const turn3 = {
      output: 1500,
      duration: 20000,
      generation: 16000,
      cost: { total: 0.003 },
    };

    describe("when calculating accumulated metrics", () => {
      it("then total output tokens should sum to 3000", () => {
        const totalOutput = turn1.output + turn2.output + turn3.output;
        expect(totalOutput).toBe(3000);
      });

      it("then total duration should be 45000ms", () => {
        const totalDuration = turn1.duration + turn2.duration + turn3.duration;
        expect(totalDuration).toBe(45000);
      });

      it("then total generation time should be 36000ms", () => {
        const totalGeneration =
          turn1.generation + turn2.generation + turn3.generation;
        expect(totalGeneration).toBe(36000);
      });

      it("then aggregate tok/s should use generation time, not duration", () => {
        const totalOutput = turn1.output + turn2.output + turn3.output;
        const totalGeneration =
          turn1.generation + turn2.generation + turn3.generation;
        // 3000 tokens / 36s = 83.3 tok/s
        const expectedTokPerSec = totalOutput / (totalGeneration / 1000);
        expect(expectedTokPerSec.toFixed(1)).toBe("83.3");
      });

      it("then total cost should be $0.006", () => {
        const totalCost =
          turn1.cost.total + turn2.cost.total + turn3.cost.total;
        expect(totalCost).toBe(0.006);
      });
    });
  });

  /**
   * Edge case: Very short duration
   */
  describe("given a very short duration (milliseconds)", () => {
    const durationMs = 123;
    const outputTokens = 10;
    const cost = { total: 0.000001 };

    describe("when formatting the output without generation time", () => {
      it("then duration should show 2 decimal places", () => {
        const result = formatSimpleOutput(outputTokens, durationMs, cost);
        expect(result).toContain("0.12s");
      });

      it("then tok/s should not be shown (no generation time)", () => {
        const result = formatSimpleOutput(outputTokens, durationMs, cost);
        expect(result).not.toContain("tok/s");
      });

      it("then cost should be excluded when it rounds to $0.00", () => {
        const result = formatSimpleOutput(outputTokens, durationMs, cost);
        expect(result).not.toContain("$");
      });
    });
  });

  /**
   * Edge case: Large token counts
   */
  describe("given large token counts (millions)", () => {
    const outputTokens = 1500000; // 1.5M
    const durationMs = 3600000; // 1 hour
    const generationMs = 3000000; // 50 minutes generation time
    const cost = { total: 0.15 };

    describe("when formatting the output", () => {
      it("then output tokens should be formatted as '1.5M'", () => {
        const result = formatSimpleOutput(
          outputTokens,
          durationMs,
          cost,
          generationMs,
        );
        expect(result).toContain("↓1.5M");
      });

      it("then duration should be formatted as '1h 0m 0s'", () => {
        const result = formatSimpleOutput(
          outputTokens,
          durationMs,
          cost,
          generationMs,
        );
        expect(result).toContain("1h 0m 0s");
      });

      it("then tok/s should be based on generation time", () => {
        // 1.5M tokens / 3000s = 500 tok/s
        const result = formatSimpleOutput(
          outputTokens,
          durationMs,
          cost,
          generationMs,
        );
        expect(result).toContain("500.0 tok/s");
      });

      it("then cost should be formatted as '$0.15'", () => {
        const result = formatSimpleOutput(
          outputTokens,
          durationMs,
          cost,
          generationMs,
        );
        expect(result).toContain("$0.15");
      });
    });
  });
});
