import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { renderTextToolResult } from "../../shared/render-utils";

// Type definitions for stock market data
export interface StockData {
  meta: YahooFinanceChartResult["meta"];
  chart: YahooFinanceResponse["chart"];
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

interface YahooFinanceChartResult {
  meta: {
    regularMarketPrice: number;
    chartPreviousClose: number;
    currency: string;
    timezone: string;
    symbol: string;
    currencySymbol: string;
  };
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
}

interface YahooFinanceResponse {
  chart: {
    result: YahooFinanceChartResult[];
  };
}

// Constants for the stock market extension
const YAHOO_FINANCE_BASE_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/";
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

    const url = `${YAHOO_FINANCE_BASE_URL}${symbol.toUpperCase()}?interval=${interval}&range=${range}`;

    // Retry logic for rate limiting
    let retries = 0;
    const maxRetries = 3;
    let data: YahooFinanceResponse | null = null;
    while (retries < maxRetries) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 429) {
            const waitTime = Math.pow(2, retries) * 1000;
            console.log(
              `Rate limited, waiting ${waitTime}ms before retry ${retries + 1}`,
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            retries++;
            continue;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        data = await response.json();

        if (!data?.chart?.result?.[0]) {
          return null;
        }

        break;
      } catch (error) {
        if (retries === maxRetries - 1) throw error;
        retries++;
        await new Promise((resolve) => setTimeout(resolve, retries * 1000));
      }
    }

    if (!data?.chart?.result?.[0]) return null;

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
      meta: result.meta,
      chart: data.chart,
      currentPrice,
      previousClose,
      change,
      changePercent,
      open: quote.open[latestIdx] ?? undefined,
      high: quote.high[latestIdx] ?? undefined,
      low: quote.low[latestIdx] ?? undefined,
      volume: quote.volume[latestIdx] ?? undefined,
      timestamp: result.timestamp,
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
    if (cached?.key === key && Date.now() - cached.timestamp < 300000) {
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
        // Require symbol parameter - don't silently default
        const symbol = params.symbol;
        if (!symbol) {
          return createStockErrorResult(
            "Please specify a stock symbol (e.g., AAPL, MSFT, NVDA). Example: stocks(symbol='AAPL', range='1d')",
          );
        }

        const range = params.range || "1d";
        const data = await getCachedStockData(symbol, range);
        const summary = formatStockSummary(data);

        return {
          content: [{ type: "text", text: summary }],
          details: { stock: data },
        } as AgentToolResult<{ stock: StockData; error?: string }>;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Provide more helpful error message for API failures
        if (message.includes("Failed to fetch") || message.includes("500")) {
          return createStockErrorResult(
            `Yahoo Finance API is temporarily unavailable. Please try again later or use a different symbol.`,
          );
        }
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
      return renderTextToolResult(result, theme);
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
