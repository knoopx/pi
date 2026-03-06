import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { renderTextToolResult } from "../../shared/render-utils";
import { dotJoin, sectionDivider, table } from "../renderers";
import type { Column } from "../renderers";
import { fetchWeather } from "./api";
import {
  createWeatherErrorResult,
  formatWeatherSummary,
  formatHourlySummary,
} from "./emoji";
import type { WeatherInfo, WeatherUnit } from "./types";

function formatWeatherOutput(info: WeatherInfo): string {
  const location = `${info.latitude.toFixed(3)}, ${info.longitude.toFixed(3)}`;
  const dayNight = info.isDay ? "day" : "night";

  const lines: string[] = [
    dotJoin(location, dayNight),
    "",
    `${info.icon} ${info.description} · ${info.temperature}°${info.unit}`,
  ];

  if (info.moonPhase) {
    lines.push(`${info.moonPhase.icon} ${info.moonPhase.name}`);
  }

  if (info.hourly.length > 0) {
    lines.push("");
    lines.push(sectionDivider("Forecast"));

    const forecastCols: Column[] = [
      {
        key: "time",
        align: "right",
      },
      {
        key: "weather",
      },
      {
        key: "temp",
        align: "right",
      },
    ];

    const forecastRows = info.hourly.map((entry) => ({
      time: new Date(entry.time).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      weather: `${entry.icon} ${entry.description}`,
      temp: `${entry.temperature}°${info.unit}`,
    }));

    lines.push(table(forecastCols, forecastRows));
  }

  return lines.join("\n");
}

export default function weatherExtension(pi: ExtensionAPI) {
  let cached: { key: string; info: WeatherInfo; timestamp: number } | null =
    null;

  const getCachedWeather = async (
    latitude?: number,
    longitude?: number,
    unit: WeatherUnit = "C",
  ): Promise<WeatherInfo> => {
    const key = `${latitude ?? "ip"}:${longitude ?? "ip"}:${unit}`;
    if (cached?.key === key && Date.now() - cached.timestamp < 300000) {
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
      _signal: AbortSignal | undefined,
      _onUpdate:
        | AgentToolUpdateCallback<{ weather?: WeatherInfo; error?: string }>
        | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const unit = params.units === "f" ? "F" : "C";
        const info = await getCachedWeather(
          params.latitude,
          params.longitude,
          unit,
        );

        return {
          content: [{ type: "text", text: formatWeatherOutput(info) }],
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
      return renderTextToolResult(result, theme);
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
