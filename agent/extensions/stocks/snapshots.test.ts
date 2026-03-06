/**
 * Snapshot tests for Stocks tool output formatting.
 */

import { describe, expect, it } from "vitest";
import { formatStockSummary, formatStockOutput, type StockData } from "./index";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

const baseStock: StockData = {
  meta: {
    regularMarketPrice: 162.85,
    chartPreviousClose: 150.25,
    currency: "USD",
    timezone: "America/New_York",
    symbol: "AAPL",
    currencySymbol: "$",
  },
  chart: { result: [] },
  currentPrice: 162.85,
  previousClose: 150.25,
  change: 12.6,
  changePercent: 8.39,
  open: 151.0,
  high: 163.0,
  low: 149.5,
  volume: 120000,
  timestamp: [1704067200, 1704153600],
};

describe("stocks output snapshots", () => {
  describe("formatStockSummary", () => {
    it("renders positive change", () => {
      expect(formatStockSummary(baseStock)).toBe("AAPL 162.85 ▲ +8.39%");
    });

    it("renders negative change", () => {
      const data: StockData = {
        ...baseStock,
        currentPrice: 145.0,
        change: -5.25,
        changePercent: -3.49,
      };
      expect(formatStockSummary(data)).toBe("AAPL 145.00 ▼ -3.49%");
    });
  });

  describe("formatStockOutput", () => {
    it("renders full stock detail for 1d range", () => {
      expect(stripAnsi(formatStockOutput(baseStock, "1d"))).toMatchSnapshot();
    });

    it("renders stock with missing optional fields", () => {
      const partial: StockData = {
        ...baseStock,
        open: undefined,
        high: undefined,
        low: undefined,
        volume: undefined,
      };
      expect(stripAnsi(formatStockOutput(partial, "1m"))).toMatchSnapshot();
    });

    it("renders negative change detail", () => {
      const negative: StockData = {
        ...baseStock,
        currentPrice: 140.0,
        previousClose: 150.25,
        change: -10.25,
        changePercent: -6.82,
        open: 149.0,
        high: 150.0,
        low: 138.5,
        volume: 250000,
      };
      expect(stripAnsi(formatStockOutput(negative, "1w"))).toMatchSnapshot();
    });
  });
});
