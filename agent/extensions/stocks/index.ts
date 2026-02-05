import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";

// Type definitions for stock market data
export interface StockData {
  meta: {
    regularMarketPrice: number;
    chartPreviousClose: number;
    currency: string;
    timezone: string;
    symbol: string;
    currencySymbol: string;
  };
  chart: {
    result: [
      {
        timestamp: number[];
        indicators: {
          quote: [
            {
              open: (number | null)[];
              close: (number | null)[];
              high: (number | null)[];
              low: (number | null)[];
              volume: (number | null)[];
            },
          ];
        };
      },
    ];
  };
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  timestamp?: number[];
}

// Constants for the stock market extension
const YAHOO_FINANCE_BASE_URL =
  "https://query1.finance.yahoo.com/v6/api/builtin/chart/";
const USER_AGENT = "Mozilla/5.0 (compatible; StockMarketExtension/1.0)";
const VALID_RANGES = [
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
] as const;

/**
 * Fetch comprehensive stock market data
 */
export async function fetchStockData(
  symbol: string,
  range:
    | "1d"
    | "1w"
    | "1m"
    | "3m"
    | "6m"
    | "1y"
    | "ytd"
    | "2y"
    | "5y"
    | "max" = "1d",
): Promise<StockData | null> {
  try {
    // Validate and normalize range parameter
    if (!VALID_RANGES.includes(range)) {
      console.warn(
        `Invalid range "${range}". Using default "1d". Valid ranges: ${VALID_RANGES.join(", ")}`,
        "1d",
      );
      range = "1d";
    }

    // Determine appropriate interval based on range
    let interval = "1d";
    if (range === "ytd") interval = "1wk";
    else if (range === "1y") interval = "1wk";
    else if (range === "5y" || range === "max") interval = "1mo";

    const response = await fetch(
      `${YAHOO_FINANCE_BASE_URL}${symbol.toUpperCase()}?interval=${interval}&range=${range}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      return null;
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];
    if (!quote) return null;
    const timestamps = result.timestamp;
    const rawCloses = quote.close.filter(
      (p: number | null): p is number => p !== null && !isNaN(p),
    );

    if (!timestamps.length || !quote.close.length) {
      return null;
    }

    if (rawCloses.length === 0) {
      return null;
    }

    // Calculate price metrics
    const currentPrice =
      rawCloses[rawCloses.length - 1] ?? meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose ?? currentPrice;
    const change = currentPrice - previousClose;
    const changePercent =
      previousClose !== 0 ? (change / previousClose) * 100 : 0;

    // Find the latest valid index for other fields
    let latestIdx = quote.close.length - 1;
    while (
      latestIdx >= 0 &&
      (quote.close[latestIdx] == null || isNaN(quote.close[latestIdx]!))
    ) {
      latestIdx--;
    }
    if (latestIdx < 0) {
      return null;
    }

    return {
      ...result,
      currentPrice,
      previousClose,
      change,
      changePercent,
      open: quote.open[latestIdx] || undefined,
      high: quote.high[latestIdx] || undefined,
      low: quote.low[latestIdx] || undefined,
      volume: quote.volume[latestIdx] || undefined,
    };
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error);
    return null;
  }
}

export function formatStockSummary(data: StockData): string {
  const base = `📊 ${data.currentPrice.toFixed(2)} (${data.changePercent >= 0 ? "+" : ""}${data.changePercent.toFixed(2)}%)`;
  return base;
}

/**
 * Helper function to create an error result
 */
function createStockErrorResult(
  message: string,
): AgentToolResult<{ stock?: StockData; error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}

export * from "./index";

export default function (pi: ExtensionAPI) {
  let cached: { key: string; data: StockData; timestamp: number } | null = null;

  const getCachedStockData = async (
    symbol: string,
    range:
      | "1d"
      | "1w"
      | "1m"
      | "3m"
      | "6m"
      | "1y"
      | "ytd"
      | "2y"
      | "5y"
      | "max" = "1d",
  ): Promise<StockData> => {
    const key = `${symbol}:${range}`;
    if (
      cached &&
      cached.key === key &&
      Date.now() - cached.timestamp < 300000
    ) {
      return cached.data;
    }
    const data = await fetchStockData(symbol, range);
    if (!data) {
      throw new Error(`Failed to fetch stock data for ${symbol}`);
    }
    cached = { key, data, timestamp: Date.now() };
    return data;
  };

  pi.registerTool({
    name: "stocks",
    label: "Stocks",
    description: "Get stock market data from Yahoo Finance",
    parameters: Type.Object({
      symbol: Type.Optional(
        Type.String({ description: "Stock symbol (e.g., AAPL, MSFT)" }),
      ),
      range: Type.Optional(
        StringEnum([...VALID_RANGES] as const, {
          description: "Time range",
        }),
      ),
    }),

    async execute(
      _toolCallId,
      params: {
        symbol?: string | undefined;
        range?:
          | "1d"
          | "1w"
          | "1m"
          | "3m"
          | "6m"
          | "1y"
          | "ytd"
          | "2y"
          | "5y"
          | "max"
          | undefined;
      },
      _signal: AbortSignal | undefined,
      _onUpdate:
        | AgentToolUpdateCallback<{ stock?: StockData; error?: string }>
        | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const symbol = params.symbol || "AAPL"; // Default to Apple
        const range = params.range || "1d";
        const data = await getCachedStockData(symbol, range);
        const summary = formatStockSummary(data);

        return {
          content: [{ type: "text", text: summary }],
          details: { stock: data },
        } as AgentToolResult<{ stock: StockData; error?: string }>;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createStockErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("stocks"));
      if (args.symbol) {
        text += theme.fg("muted", ` ${args.symbol.toUpperCase()}`);
      }
      if (args.range && args.range !== "1d") {
        text += theme.fg("dim", ` (${args.range})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { stock?: StockData; error?: string }
        | undefined;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      return new Text(text, 0, 0);
    },
  });

  pi.registerCommand("stocks", {
    description: "Show stock market data",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      try {
        const data = await getCachedStockData("AAPL", "1d");
        const summary = formatStockSummary(data);
        ctx.ui.notify(summary, "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Stocks error: ${message}`, "error");
      }
    },
  });
}
