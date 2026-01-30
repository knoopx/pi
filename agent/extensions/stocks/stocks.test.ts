/**
 * Stocks Extension Tests
 * Tests for stock market data fetching, formatting, caching, and edge cases
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchStockData, formatStockSummary, type StockData } from "./index";

// Mock the global fetch function

describe("Stocks Extension", () => {
  // ============================================
  // Stock Data Fetching
  // ============================================
  describe("fetchStockData", () => {
    describe("given a valid stock symbol", () => {
      let mockResponse: unknown;

      beforeEach(() => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;

        mockResponse = {
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 162.85,
                    chartPreviousClose: 150.25,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200, 1704153600],
                  indicators: {
                    quote: [
                      {
                        open: [150.0, 151.0],
                        close: [150.5, 162.85],
                        high: [151.0, 163.0],
                        low: [149.5, 151.5],
                        volume: [100000, 120000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        };

        mockFetch.mockResolvedValue(mockResponse);
      });

      it("then it should fetch stock data from Yahoo Finance", async () => {
        const result = await fetchStockData("AAPL");
        expect(result).toBeDefined();
        expect(result?.meta.symbol).toBe("AAPL");
      });

      it("then it should return current price", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.currentPrice).toBe(162.85);
      });

      it("then it should return previous close price", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.previousClose).toBe(150.25);
      });

      it("then it should calculate correct change", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.change).toBeCloseTo(12.6, 1);
      });

      it("then it should calculate correct change percentage", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.changePercent).toBeCloseTo(8.39, 2);
      });

      it("then it should return opening price", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.open).toBe(151.0);
      });

      it("then it should return high price", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.high).toBe(163.0);
      });

      it("then it should return low price", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.low).toBe(151.5);
      });

      it("then it should return volume", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.volume).toBe(120000);
      });

      it("then it should return timestamp array", async () => {
        const result = await fetchStockData("AAPL");
        expect(result?.timestamp).toEqual([1704067200, 1704153600]);
      });

      it("then it should use 1d interval for default range", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue(mockResponse);
        await fetchStockData("AAPL");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("interval=1d"),
          expect.objectContaining({ headers: expect.any(Object) }),
        );
      });

      it("then it should use 1wk interval for ytd range", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue(mockResponse);
        await fetchStockData("AAPL", "ytd");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("interval=1wk"),
          expect.any(Object),
        );
      });

      it("then it should use 1wk interval for 1y range", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue(mockResponse);
        await fetchStockData("AAPL", "1y");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("interval=1wk"),
          expect.any(Object),
        );
      });

      it("then it should use 1mo interval for 5y range", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue(mockResponse);
        await fetchStockData("AAPL", "5y");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("interval=1mo"),
          expect.any(Object),
        );
      });

      it("then it should use 1mo interval for max range", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue(mockResponse);
        await fetchStockData("AAPL", "max");
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("interval=1mo"),
          expect.any(Object),
        );
      });
    });

    describe("given a stock symbol in lowercase", () => {
      it("then it should be converted to uppercase", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        const mockResponse = {
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 90.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "MSFT",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [100.0],
                        close: [100.0],
                        high: [100.0],
                        low: [100.0],
                        volume: [50000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        };
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue(mockResponse);

        const result = await fetchStockData("msft");
        expect(result?.meta.symbol).toBe("MSFT");
      });
    });

    describe("given an invalid range parameter", () => {
      let consoleWarnSpy: unknown;
      let mockFetch: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      });

      beforeEach(() => {
        const mockResponse = {
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [100.0],
                        close: [100.0],
                        high: [100.0],
                        low: [100.0],
                        volume: [10000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        };
        mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue(mockResponse);
      });

      it("then it should log warning and use default range", async () => {
        await fetchStockData("AAPL", "invalid-range" as unknown);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("Invalid range"),
          expect.stringContaining("1d"),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("range=1d"),
          expect.any(Object),
        );
      });

      it("then it should return valid data anyway", async () => {
        const result = await fetchStockData("AAPL", "invalid-range" as unknown);
        expect(result).toBeDefined();
        expect(result?.currentPrice).toBe(100.0);
      });
    });

    describe("given HTTP 404 response", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
        });

        const result = await fetchStockData("UNKNOWNSTOCK");
        expect(result).toBeNull();
      });
    });

    describe("given HTTP 500 response", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given HTTP 403 response", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given network error", () => {
      it("then it should return null and log error", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        mockFetch.mockRejectedValue(new Error("Network error"));

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error fetching stock data"),
          expect.any(Error),
        );
      });
    });

    describe("given fetch throws generic error", () => {
      it("then it should return null and log error", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        mockFetch.mockRejectedValue(new Error("Unexpected error"));

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining("Error fetching stock data"),
          expect.any(Error),
        );
      });
    });

    describe("given response with no chart.result", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given response with null result", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: null,
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given response with empty quotes array", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [],
                  indicators: {
                    quote: [
                      {
                        open: [],
                        close: [],
                        high: [],
                        low: [],
                        volume: [],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given response with null or NaN close prices", () => {
      it("then it should filter out null and NaN values", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [150.0, null, NaN, 151.0],
                        close: [150.5, null, NaN, 152.0],
                        high: [151.0, null, NaN, 153.0],
                        low: [149.5, null, NaN, 151.5],
                        volume: [100000, null, NaN, 120000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeDefined();
        expect(result?.currentPrice).toBe(152.0);
      });
    });

    describe("given response with timestamps but no close prices", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200, 1704153600],
                  indicators: {
                    quote: [
                      {
                        open: [150.0],
                        close: [null],
                        high: [151.0],
                        low: [149.5],
                        volume: [100000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given response with no timestamps", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [],
                  indicators: {
                    quote: [
                      {
                        open: [150.0],
                        close: [150.5],
                        high: [151.0],
                        low: [149.5],
                        volume: [100000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given response with empty close prices array", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [150.0],
                        close: [],
                        high: [151.0],
                        low: [149.5],
                        volume: [100000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given response with only null close prices", () => {
      it("then it should return null", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [150.0],
                        close: [null, null, null],
                        high: [151.0],
                        low: [149.5],
                        volume: [100000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeNull();
      });
    });

    describe("given valid response with regularMarketPrice", () => {
      it("then it should use regularMarketPrice when available", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 200.0,
                    chartPreviousClose: 180.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [190.0],
                        close: [200.0],
                        high: [205.0],
                        low: [188.0],
                        volume: [150000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result?.currentPrice).toBe(200.0);
        expect(result?.change).toBe(20.0);
        expect(result?.changePercent).toBeCloseTo(11.11, 2);
      });
    });

    describe("given valid response without regularMarketPrice", () => {
      it("then it should use last valid close price", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    chartPreviousClose: 180.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [175.0],
                        close: [190.0],
                        high: [195.0],
                        low: [170.0],
                        volume: [180000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result?.currentPrice).toBe(190.0);
        expect(result?.change).toBe(10.0);
        expect(result?.changePercent).toBeCloseTo(5.56, 2);
      });
    });

    describe("given valid response with zero previous close", () => {
      it("then it should handle zero division gracefully", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 100.0,
                    chartPreviousClose: 0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [95.0],
                        close: [100.0],
                        high: [105.0],
                        low: [90.0],
                        volume: [110000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toBeDefined();
        expect(result?.currentPrice).toBe(100.0);
      });
    });

    describe("given valid response with negative change", () => {
      it("then it should calculate negative change correctly", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 95.0,
                    chartPreviousClose: 100.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [98.0],
                        close: [95.0],
                        high: [99.0],
                        low: [94.0],
                        volume: [95000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result?.change).toBe(-5.0);
        expect(result?.changePercent).toBeCloseTo(-5.0, 2);
      });
    });

    describe("given valid response with large price differences", () => {
      it("then it should handle large price differences correctly", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 1000.0,
                    chartPreviousClose: 1.0,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [500.0],
                        close: [1000.0],
                        high: [1100.0],
                        low: [400.0],
                        volume: [1000000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result?.change).toBe(999.0);
        expect(result?.changePercent).toBeCloseTo(99900.0, 2);
      });
    });

    describe("given valid response with fractional prices", () => {
      it("then it should handle fractional prices correctly", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 123.45,
                    chartPreviousClose: 122.3,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [122.5],
                        close: [123.45],
                        high: [124.0],
                        low: [122.0],
                        volume: [125000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result?.currentPrice).toBe(123.45);
        expect(result?.change).toBeCloseTo(1.15, 2);
        expect(result?.changePercent).toBeCloseTo(0.94, 2);
      });
    });

    // ============================================
    // Stock Summary Formatting
    // ============================================
    describe("formatStockSummary", () => {
      describe("given stock data with positive change", () => {
        it("then it should format summary with positive change", () => {
          const data = {
            currentPrice: 150.5,
            previousClose: 140.25,
            change: 10.25,
            changePercent: 7.31,
          };

          const result = formatStockSummary(data as StockData);
          expect(result).toBe("📊 150.50 (+7.31%)");
        });
      });

      describe("given stock data with negative change", () => {
        it("then it should format summary with negative change", () => {
          const data = {
            currentPrice: 95.0,
            previousClose: 100.0,
            change: -5.0,
            changePercent: -5.0,
          };

          const result = formatStockSummary(data as StockData);
          expect(result).toBe("📊 95.00 (-5.00%)");
        });
      });

      describe("given stock data with zero change", () => {
        it("then it should format summary with zero change", () => {
          const data = {
            currentPrice: 100.0,
            previousClose: 100.0,
            change: 0,
            changePercent: 0,
          };

          const result = formatStockSummary(data as StockData);
          expect(result).toBe("📊 100.00 (+0.00%)");
        });
      });

      describe("given stock data with large positive change", () => {
        it("then it should format summary with large positive change", () => {
          const data = {
            currentPrice: 1000.0,
            previousClose: 1.0,
            change: 999.0,
            changePercent: 99990.0,
          };

          const result = formatStockSummary(data as StockData);
          expect(result).toBe("📊 1000.00 (+99990.00%)");
        });
      });

      describe("given stock data with large negative change", () => {
        it("then it should format summary with large negative change", () => {
          const data = {
            currentPrice: 0.5,
            previousClose: 100.0,
            change: -99.5,
            changePercent: -99.5,
          };

          const result = formatStockSummary(data as StockData);
          expect(result).toBe("📊 0.50 (-99.50%)");
        });
      });

      describe("given stock data with fractional changes", () => {
        it("then it should format summary with fractional changes", () => {
          const data = {
            currentPrice: 123.456,
            previousClose: 122.3,
            change: 1.156,
            changePercent: 0.945,
          };

          const result = formatStockSummary(data as StockData);
          expect(result).toBe("📊 123.46 (+0.94%)");
        });
      });

      describe("given stock data with very small changes", () => {
        it("then it should format summary with small changes", () => {
          const data = {
            currentPrice: 100.001,
            previousClose: 100.0,
            change: 0.001,
            changePercent: 0.001,
          };

          const result = formatStockSummary(data as StockData);
          expect(result).toBe("📊 100.00 (+0.00%)");
        });
      });
    });

    // ============================================
    // Edge Cases
    // ============================================
    describe("given edge cases", () => {
      describe("given single data point", () => {
        it("then it should handle single data point correctly", async () => {
          const mockFetch = vi.fn();
          globalThis.fetch = mockFetch as unknown;
          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 100.0,
                      chartPreviousClose: 100.0,
                      currency: "USD",
                      timezone: "America/New_York",
                      symbol: "AAPL",
                      currencySymbol: "$",
                    },
                    timestamp: [1704067200],
                    indicators: {
                      quote: [
                        {
                          open: [100.0],
                          close: [100.0],
                          high: [100.0],
                          low: [100.0],
                          volume: [10000],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          });

          const result = await fetchStockData("AAPL");
          expect(result).toBeDefined();
          expect(result?.currentPrice).toBe(100.0);
          expect(result?.change).toBe(0.0);
          expect(result?.changePercent).toBe(0);
        });
      });

      describe("given multiple data points", () => {
        it("then it should use the last data point", async () => {
          const mockFetch = vi.fn();
          globalThis.fetch = mockFetch as unknown;
          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 150.0,
                      chartPreviousClose: 100.0,
                      currency: "USD",
                      timezone: "America/New_York",
                      symbol: "AAPL",
                      currencySymbol: "$",
                    },
                    timestamp: [
                      1704067200, 1704153600, 1704240000, 1704326400,
                      1704412800,
                    ],
                    indicators: {
                      quote: [
                        {
                          open: [100.0, 110.0, 120.0, 130.0, 150.0],
                          close: [105.0, 115.0, 125.0, 135.0, 150.0],
                          high: [108.0, 118.0, 128.0, 138.0, 155.0],
                          low: [102.0, 112.0, 122.0, 132.0, 145.0],
                          volume: [100000, 110000, 120000, 130000, 150000],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          });

          const result = await fetchStockData("AAPL");
          expect(result).toBeDefined();
          expect(result?.currentPrice).toBe(150.0);
          expect(result?.open).toBe(150.0);
          expect(result?.high).toBe(155.0);
          expect(result?.low).toBe(145.0);
          expect(result?.volume).toBe(150000);
        });
      });

      describe("given response with sparse data", () => {
        it("then it should skip null values and use last valid point", async () => {
          const mockFetch = vi.fn();
          globalThis.fetch = mockFetch as unknown;
          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 150.0,
                      chartPreviousClose: 100.0,
                      currency: "USD",
                      timezone: "America/New_York",
                      symbol: "AAPL",
                      currencySymbol: "$",
                    },
                    timestamp: [1704067200, 1704153600, 1704240000],
                    indicators: {
                      quote: [
                        {
                          open: [100.0, null, 120.0],
                          close: [105.0, null, 150.0],
                          high: [108.0, null, 155.0],
                          low: [102.0, null, 145.0],
                          volume: [100000, null, 150000],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          });

          const result = await fetchStockData("AAPL");
          expect(result).toBeDefined();
          expect(result?.currentPrice).toBe(150.0);
          expect(result?.open).toBe(120.0);
          expect(result?.high).toBe(155.0);
          expect(result?.low).toBe(145.0);
          expect(result?.volume).toBe(150000);
        });
      });

      describe("given currency symbols", () => {
        it("then it should handle different currencies", async () => {
          const mockFetch = vi.fn();
          globalThis.fetch = mockFetch as unknown;
          mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 100.0,
                      chartPreviousClose: 90.0,
                      currency: "EUR",
                      timezone: "Europe/London",
                      symbol: "EURSTOCK",
                      currencySymbol: "€",
                    },
                    timestamp: [1704067200],
                    indicators: {
                      quote: [
                        {
                          open: [95.0],
                          close: [100.0],
                          high: [105.0],
                          low: [90.0],
                          volume: [50000],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          });

          const result = await fetchStockData("EURSTOCK");
          expect(result).toBeDefined();
          expect(result?.meta.symbol).toBe("EURSTOCK");
          expect(result?.meta.currency).toBe("EUR");
          expect(result?.meta.currencySymbol).toBe("€");
        });
      });
    });
  });

  // ============================================
  // Range Validation Tests
  // ============================================
  describe("range validation", () => {
    describe("given all valid ranges", () => {
      const validRanges = [
        "1d",
        "1w",
        "1m",
        "3m",
        "6m",
        "1y",
        "ytd",
        "2y",
        "5y",
        "max",
      ];

      validRanges.forEach((range) => {
        it(`then it should accept range: ${range}`, async () => {
          const mockFetch = vi.fn();
          globalThis.fetch = mockFetch as unknown;
          const mockResponse = {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 100.0,
                      chartPreviousClose: 100.0,
                      currency: "USD",
                      timezone: "America/New_York",
                      symbol: "AAPL",
                      currencySymbol: "$",
                    },
                    timestamp: [1704067200],
                    indicators: {
                      quote: [
                        {
                          open: [100.0],
                          close: [100.0],
                          high: [100.0],
                          low: [100.0],
                          volume: [10000],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          };
          globalThis.fetch = mockFetch as unknown;
          mockFetch.mockResolvedValue(mockResponse);

          const result = await fetchStockData("AAPL", range as unknown);
          expect(result).toBeDefined();
        });
      });
    });

    describe("given invalid ranges", () => {
      const invalidRanges = [
        "invalid",
        "abc",
        "123",
        "1",
        "7d",
        "2y5m",
        "all",
        "weekly",
      ];

      invalidRanges.forEach((range) => {
        it(`then it should handle invalid range: ${range}`, async () => {
          const mockFetch = vi.fn();
          globalThis.fetch = mockFetch as unknown;
          const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});
          const mockResponse = {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 100.0,
                      chartPreviousClose: 100.0,
                      currency: "USD",
                      timezone: "America/New_York",
                      symbol: "AAPL",
                      currencySymbol: "$",
                    },
                    timestamp: [1704067200],
                    indicators: {
                      quote: [
                        {
                          open: [100.0],
                          close: [100.0],
                          high: [100.0],
                          low: [100.0],
                          volume: [10000],
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          };
          globalThis.fetch = mockFetch as unknown;
          mockFetch.mockResolvedValue(mockResponse);

          await fetchStockData("AAPL", range as unknown);
          expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Invalid range"),
            expect.stringContaining("1d"),
          );
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("range=1d"),
            expect.any(Object),
          );
        });
      });
    });
  });

  // ============================================
  // Data Integrity Tests
  // ============================================
  describe("data integrity", () => {
    beforeEach(() => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch as unknown;
    });

    describe("given complete stock data structure", () => {
      it("then it should return all expected fields", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 150.5,
                    chartPreviousClose: 140.25,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200, 1704153600],
                  indicators: {
                    quote: [
                      {
                        open: [150.0, 151.0],
                        close: [150.5, 152.0],
                        high: [151.0, 153.0],
                        low: [149.5, 151.5],
                        volume: [100000, 120000],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result).toMatchObject({
          meta: {
            symbol: "AAPL",
            regularMarketPrice: 150.5,
            chartPreviousClose: 140.25,
            currency: "USD",
            currencySymbol: "$",
            timezone: "America/New_York",
          },
          currentPrice: 152, // Last close value from the quote array
          previousClose: 140.25,
          change: 11.75,
          changePercent: expect.any(Number),
          open: 151.0,
          high: 153.0,
          low: 151.5,
          volume: 120000,
          timestamp: [1704067200, 1704153600],
        });
      });
    });

    describe("given data with all valid numeric types", () => {
      it("then it should handle all numeric types correctly", async () => {
        const mockFetch = vi.fn();
        globalThis.fetch = mockFetch as unknown;
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 123456.789,
                    chartPreviousClose: 123456.789,
                    currency: "USD",
                    timezone: "America/New_York",
                    symbol: "AAPL",
                    currencySymbol: "$",
                  },
                  timestamp: [1704067200],
                  indicators: {
                    quote: [
                      {
                        open: [123456.789],
                        close: [123456.789],
                        high: [123456.789],
                        low: [123456.789],
                        volume: [123456789],
                      },
                    ],
                  },
                },
              ],
            },
          }),
        });

        const result = await fetchStockData("AAPL");
        expect(result?.currentPrice).toBe(123456.789);
        expect(result?.changePercent).toBe(0);
      });
    });
  });
});
