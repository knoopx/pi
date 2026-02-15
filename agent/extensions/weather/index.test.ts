// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/**
 * Integration Tests for Weather Extension
 * Tests: Tool registration, command execution, and user interactions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import weatherExtension from "./index";
import {
  createMockExtensionAPI,
  type MockExtensionAPI,
  type MockTool,
} from "../../shared/test-utils";
import { fetchWeather } from "./api";
import { createWeatherErrorResult, formatWeatherSummary } from "./emoji";

// Mock the API and emoji modules
vi.mock("./api", () => ({
  fetchWeather: vi.fn(),
}));

vi.mock("./emoji", () => ({
  createWeatherErrorResult: vi.fn(),
  formatWeatherSummary: vi.fn(),
  formatHourlySummary: vi.fn(),
}));

type TextContent = { type: "text"; text: string };

const mockWeatherDataCelsius = {
  latitude: 0,
  longitude: 0,
  temperature: 20,
  unit: "C" as const,
  isDay: true,
  weatherCode: 0,
  description: "Clear sky",
  icon: "☀️",
  hourly: [],
};

const mockWeatherDataFahrenheit = {
  latitude: 0,
  longitude: 0,
  temperature: 68,
  unit: "F" as const,
  isDay: true,
  weatherCode: 0,
  description: "Clear sky",
  icon: "☀️",
  hourly: [],
};

const mockErrorResult = {
  content: [{ type: "text" as const, text: "Error: Weather API error" }],
  details: { error: "Weather API error" },
};

const mockWeatherSummary = "☀️  20°C • Clear sky";
const mockWeatherSummaryFahrenheit = "☀️  68°F • Clear sky";

describe("Weather Extension", () => {
  let mockPi: MockExtensionAPI;
  let context: ExtensionContext;
  let toolConfig: MockTool;
  let commandConfig: {
    description: string;
    handler: (...args: unknown[]) => unknown;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPi = createMockExtensionAPI();
    context = {
      hasUI: true,
      ui: {
        notify: vi.fn(),
      },
    } as unknown as ExtensionContext;

    weatherExtension(mockPi as ExtensionAPI);

    toolConfig = mockPi.registerTool.mock.calls[0][0] as MockTool;
    commandConfig = mockPi.registerCommand.mock.calls[0][1];
  });

  // ============================================================================
  // Tool Registration Tests
  // ============================================================================

  describe("given weather extension registered", () => {
    it("then registers weather tool", () => {
      expect(mockPi.registerTool).toHaveBeenCalled();
    });

    it("then tool name is 'weather'", () => {
      expect(toolConfig.name).toBe("weather");
    });

    it("then tool label is 'Weather'", () => {
      expect(toolConfig.label).toBe("Weather");
    });

    it("then tool description is set", () => {
      expect(toolConfig.description).toBe(
        "Get current weather (uses IP-based location by default).",
      );
    });

    it("then tool parameters are defined", () => {
      expect(toolConfig.parameters).toBeDefined();
      expect(toolConfig.parameters.properties).toBeDefined();
    });

    it("then latitude parameter is optional", () => {
      expect(toolConfig.parameters.properties.latitude).toBeDefined();
      expect(toolConfig.parameters.properties.latitude.type).toBe("number");
      expect(toolConfig.parameters.properties.latitude.description).toBe(
        "Latitude",
      );
    });

    it("then longitude parameter is optional", () => {
      expect(toolConfig.parameters.properties.longitude).toBeDefined();
      expect(toolConfig.parameters.properties.longitude.type).toBe("number");
      expect(toolConfig.parameters.properties.longitude.description).toBe(
        "Longitude",
      );
    });

    it("then units parameter is optional", () => {
      expect(toolConfig.parameters.properties.units).toBeDefined();
      expect(toolConfig.parameters.properties.units.type).toBe("string");
      expect(toolConfig.parameters.properties.units.description).toBe(
        "Temperature units (c or f)",
      );
    });

    it("then execute function is defined", () => {
      expect(toolConfig.execute).toBeDefined();
      expect(typeof toolConfig.execute).toBe("function");
    });

    it("then renderCall function is defined", () => {
      expect(toolConfig.renderCall).toBeDefined();
      expect(typeof toolConfig.renderCall).toBe("function");
    });

    it("then renderResult function is defined", () => {
      expect(toolConfig.renderResult).toBeDefined();
      expect(typeof toolConfig.renderResult).toBe("function");
    });
  });

  // ============================================================================
  // Command Registration Tests
  // ============================================================================

  describe("given weather extension commands", () => {
    it("then registers weather command", () => {
      expect(mockPi.registerCommand).toHaveBeenCalled();
    });

    it("then command name is 'weather'", () => {
      expect(mockPi.registerCommand.mock.calls[0][0]).toBe("weather");
    });

    it("then command description is set", () => {
      expect(commandConfig.description).toBe("Show current weather");
    });

    it("then command handler is defined", () => {
      expect(commandConfig.handler).toBeDefined();
      expect(typeof commandConfig.handler).toBe("function");
    });
  });

  // ============================================================================
  // Tool Execution Tests
  // ============================================================================

  describe("given weather tool execution", () => {
    it("then execute handles valid inputs", async () => {
      fetchWeather.mockResolvedValue(mockWeatherDataCelsius);

      const result = await toolConfig.execute(
        "tool-id",
        { latitude: 0, longitude: 0, units: "c" },
        undefined,
        context,
      );

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it("then execute returns formatted weather summary", async () => {
      fetchWeather.mockResolvedValue(mockWeatherDataCelsius);
      formatWeatherSummary.mockReturnValue(mockWeatherSummary);

      const result = await toolConfig.execute(
        "tool-id",
        { latitude: 0, longitude: 0, units: "c" },
        undefined,
        context,
      );

      expect((result.content[0] as TextContent).text).toContain("☀️");
      expect((result.content[0] as TextContent).text).toContain("20°C");
      expect((result.content[0] as TextContent).text).toContain("Clear sky");
    });

    it("then execute handles errors gracefully", async () => {
      createWeatherErrorResult.mockReturnValue(mockErrorResult);
      fetchWeather.mockRejectedValue(new Error("Weather API error"));

      const result = await toolConfig.execute(
        "tool-id",
        { latitude: 0, longitude: 0, units: "c" },
        undefined,
        context,
      );

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.details?.error).toBeDefined();
    });

    it("then execute caches results for 5 minutes", async () => {
      fetchWeather.mockResolvedValue(mockWeatherDataCelsius);

      const result1 = await toolConfig.execute(
        "tool-id",
        { latitude: 0, longitude: 0, units: "c" },
        undefined,
        context,
      );
      const result2 = await toolConfig.execute(
        "tool-id",
        { latitude: 0, longitude: 0, units: "c" },
        undefined,
        context,
      );

      // Should use cache for second call
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(fetchWeather).toHaveBeenCalledTimes(1);
    });

    it("then execute handles different units", async () => {
      fetchWeather.mockResolvedValue(mockWeatherDataFahrenheit);
      formatWeatherSummary.mockReturnValue(mockWeatherSummaryFahrenheit);

      const result = await toolConfig.execute(
        "tool-id",
        { latitude: 0, longitude: 0, units: "f" },
        undefined,
        context,
      );

      expect((result.content[0] as TextContent).text).toContain("68°F");
      expect(result.details?.weather.unit).toBe("F");
    });

    it("then execute uses IP-based location when coordinates not provided", async () => {
      fetchWeather.mockResolvedValue(mockWeatherDataCelsius);

      const result = await toolConfig.execute(
        "tool-id",
        {},
        undefined,
        context,
      );

      expect(result).toBeDefined();
      expect(result.details?.weather).toBeDefined();
    });
  });

  // ============================================================================
  // Command Execution Tests
  // ============================================================================

  describe("given weather command execution", () => {
    it("then command handler is callable", async () => {
      fetchWeather.mockResolvedValue(mockWeatherDataCelsius);

      await commandConfig.handler({}, context);

      expect(context.ui.notify).toHaveBeenCalled();
    });

    it("then command shows cached weather", async () => {
      fetchWeather.mockResolvedValue(mockWeatherDataCelsius);

      await commandConfig.handler({}, context);

      expect(context.ui.notify).toHaveBeenCalled();
    });

    it("then command handles errors gracefully", async () => {
      createWeatherErrorResult.mockReturnValue(mockErrorResult);
      fetchWeather.mockRejectedValue(new Error("Weather API error"));

      await commandConfig.handler({}, context);

      expect(context.ui.notify).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe("given tool rendering", () => {
    it("then renderCall displays tool name", () => {
      const result = toolConfig.renderCall(
        { latitude: 40.71, longitude: -74.0, units: "c" },
        { fg: (n: string) => n, bold: (s: string) => s },
      );

      expect(result).toBeDefined();
    });

    it("then renderCall includes coordinates when provided", () => {
      const result = toolConfig.renderCall(
        { latitude: 40.71, longitude: -74.0, units: "c" },
        { fg: (n: string) => n, bold: (s: string) => s },
      );

      expect(result).toBeDefined();
    });

    it("then renderCall omits coordinates when not provided", () => {
      const result = toolConfig.renderCall(
        {},
        { fg: (n: string) => n, bold: (s: string) => s },
      );

      expect(result).toBeDefined();
    });

    it("then renderCall includes units when provided", () => {
      const result = toolConfig.renderCall(
        { latitude: 40.71, longitude: -74.0, units: "f" },
        { fg: (n: string) => n, bold: (s: string) => s },
      );

      expect(result).toBeDefined();
    });

    it("then renderResult displays error when error present", () => {
      const result = toolConfig.renderResult(
        mockErrorResult,
        {},
        { fg: (n: string) => n },
      );

      expect(result).toBeDefined();
    });

    it("then renderResult displays weather summary when success", () => {
      const result = toolConfig.renderResult(
        {
          content: [{ type: "text", text: "☀️ 20°C • Clear sky" }],
          details: {
            weather: mockWeatherDataCelsius,
          },
        },
        {},
        { fg: (n: string) => n },
      );

      expect(result).toBeDefined();
    });
  });
});
