import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { fetchWeather } from "./api";
import {
  createWeatherErrorResult,
  formatWeatherSummary,
  formatHourlySummary,
} from "./emoji";
import type { WeatherInfo, WeatherUnit } from "./types";

export default function weatherExtension(pi: ExtensionAPI) {
  let cached: { key: string; info: WeatherInfo; timestamp: number } | null =
    null;

  const getCachedWeather = async (
    latitude?: number,
    longitude?: number,
    unit: WeatherUnit = "C",
  ): Promise<WeatherInfo> => {
    const key = `${latitude ?? "ip"}:${longitude ?? "ip"}:${unit}`;
    if (
      cached &&
      cached.key === key &&
      Date.now() - cached.timestamp < 300000
    ) {
      return cached.info;
    }
    const info = await fetchWeather(latitude, longitude, unit);
    cached = { key, info, timestamp: Date.now() };
    return info;
  };

  pi.registerTool({
    name: "weather",
    label: "Weather",
    description: "Get current weather (uses IP-based location by default).",
    parameters: Type.Object({
      latitude: Type.Optional(Type.Number({ description: "Latitude" })),
      longitude: Type.Optional(Type.Number({ description: "Longitude" })),
      units: Type.Optional(
        Type.String({
          description: "Temperature units (c or f)",
          pattern: "^[cf]$",
        }),
      ),
    }),

    async execute(
      _toolCallId,
      params: {
        latitude?: number | undefined;
        longitude?: number | undefined;
        units?: "c" | "f" | undefined;
      },
      _onUpdate:
        | AgentToolUpdateCallback<{ weather?: WeatherInfo; error?: string }>
        | undefined,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const unit = params.units === "f" ? "F" : "C";
        const info = await getCachedWeather(
          params.latitude,
          params.longitude,
          unit,
        );
        const summary = formatWeatherSummary(info);
        const hourly = formatHourlySummary(info);
        const text = hourly ? `${summary}\n${hourly}` : summary;

        return {
          content: [{ type: "text", text }],
          details: { weather: info },
        } as AgentToolResult<{ weather: WeatherInfo; error?: string }>;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createWeatherErrorResult(message);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("weather"));
      if (args.latitude !== undefined && args.longitude !== undefined) {
        text += theme.fg(
          "muted",
          ` ${args.latitude.toFixed(2)}, ${args.longitude.toFixed(2)}`,
        );
      }
      if (args.units) {
        text += theme.fg("dim", ` ${args.units.toUpperCase()}`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { weather?: WeatherInfo; error?: string }
        | undefined;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      return new Text(text, 0, 0);
    },
  });

  pi.registerCommand("weather", {
    description: "Show current weather",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      try {
        const info = await getCachedWeather();
        const summary = formatWeatherSummary(info);
        const hourly = formatHourlySummary(info);
        ctx.ui.notify(hourly ? `${summary}\n${hourly}` : summary, "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Weather error: ${message}`, "error");
      }
    },
  });
}
