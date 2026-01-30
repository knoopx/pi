import {
  EMoonPhase,
  MoonPhaseResult,
  WeatherUnit,
  WeatherInfo,
  AgentToolResult,
  HourlyForecastEntry,
} from "./types";
import { MOON_PHASE_NAMES, moonIcons } from "./types";

const LUNAR_CYCLE = 29.5305882;
const DAYS_PER_YEAR = 365.25;
const DAYS_PER_MONTH = 30.6;
const DAYS_SINCE_NEW_MOON_1900_01_01 = 694039.09;

export function moonPhaseAlt(date: Date = new Date()): MoonPhaseResult {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return moonPhase(year, month, day);
}

function moonPhase(year: number, month: number, day: number): MoonPhaseResult {
  if (month < 3) {
    year--;
    month += 12;
  }

  month += 1;

  let totalDaysElapsed =
    DAYS_PER_YEAR * year +
    DAYS_PER_MONTH * month +
    day -
    DAYS_SINCE_NEW_MOON_1900_01_01;

  totalDaysElapsed /= LUNAR_CYCLE;

  let phase = Math.trunc(totalDaysElapsed);
  totalDaysElapsed -= phase;

  phase = Math.round(totalDaysElapsed * 8);
  if (phase >= 8) phase = 0;

  if (phase >= EMoonPhase.COUNT || phase < EMoonPhase.New) {
    throw new Error(`Invalid moon phase: ${phase}`);
  }

  return { phase, name: MOON_PHASE_NAMES[phase], icon: moonIcons[phase] };
}

export function openWeatherWMOToEmoji(
  weatherCode: number = -1,
  daylight = true,
): { value: string; originalNumericCode: number; description: string } {
  switch (weatherCode) {
    case 0:
      if (daylight) {
        return {
          value: "☀️",
          originalNumericCode: 0,
          description: "Clear sky",
        };
      }
      if (!daylight) {
        return {
          value: "🌙",
          originalNumericCode: 0,
          description: "Clear sky",
        };
      }
      break;
    case 1:
      if (daylight) {
        return {
          value: "🌤️",
          originalNumericCode: 1,
          description: "Mainly clear",
        };
      }
      if (!daylight) {
        return {
          value: "🌤️🌙",
          originalNumericCode: 1,
          description: "Mainly clear",
        };
      }
      break;
    case 2:
      return {
        value: "☁️",
        originalNumericCode: 2,
        description: "Partly cloudy",
      };
    case 3:
      if (daylight) {
        return { value: "🌥️", originalNumericCode: 3, description: "Overcast" };
      }
      if (!daylight) {
        return {
          value: "☁️🌙",
          originalNumericCode: 3,
          description: "Overcast",
        };
      }
      break;
    case 45:
      return { value: "🌫️", originalNumericCode: 45, description: "Fog" };
    case 48:
      return {
        value: "🌫️❄️",
        originalNumericCode: 48,
        description: "Depositing rime fog",
      };
    case 51:
      return {
        value: "🌧️",
        originalNumericCode: 51,
        description: "Drizzle: Light",
      };
    case 53:
      return {
        value: "🌧️",
        originalNumericCode: 53,
        description: "Drizzle: Moderate",
      };
    case 55:
      return {
        value: "🌧️",
        originalNumericCode: 55,
        description: "Drizzle: Dense intensity",
      };
    case 56:
      return {
        value: "🌨️",
        originalNumericCode: 56,
        description: "Freezing Drizzle: Light",
      };
    case 57:
      return {
        value: "🌨️",
        originalNumericCode: 57,
        description: "Freezing Drizzle: Dense intensity",
      };
    case 61:
      return {
        value: "🌦️",
        originalNumericCode: 61,
        description: "Rain: Slight",
      };
    case 63:
      return {
        value: "🌧️",
        originalNumericCode: 63,
        description: "Rain: Moderate",
      };
    case 65:
      return {
        value: "🌧️",
        originalNumericCode: 65,
        description: "Rain: Heavy intensity",
      };
    case 66:
      return {
        value: "🌧️",
        originalNumericCode: 66,
        description: "Freezing Rain: Light",
      };
    case 67:
      return {
        value: "🌧️",
        originalNumericCode: 67,
        description: "Freezing Rain: Heavy intensity",
      };
    case 71:
      return {
        value: "🌨️",
        originalNumericCode: 71,
        description: "Snow fall: Slight",
      };
    case 73:
      return {
        value: "🌨️",
        originalNumericCode: 73,
        description: "Snow fall: Moderate",
      };
    case 75:
      return {
        value: "🌨️",
        originalNumericCode: 75,
        description: "Snow fall: Heavy intensity",
      };
    case 77:
      return {
        value: "🌨️",
        originalNumericCode: 77,
        description: "Snow grains",
      };
    case 80:
      return {
        value: "🌦️",
        originalNumericCode: 80,
        description: "Rain showers: Slight",
      };
    case 81:
      return {
        value: "🌧️🌧️",
        originalNumericCode: 81,
        description: "Rain showers: Moderate",
      };
    case 82:
      return {
        value: "🌧️🌧️🌧️",
        originalNumericCode: 82,
        description: "Rain showers: Violent",
      };
    case 85:
      return {
        value: "🌨️",
        originalNumericCode: 85,
        description: "Snow showers slight",
      };
    case 86:
      return {
        value: "🌨️🌨️",
        originalNumericCode: 86,
        description: "Snow showers heavy",
      };
    case 95:
      return {
        value: "🌩️",
        originalNumericCode: 95,
        description: "Thunderstorm: Slight or moderate",
      };
    case 96:
      return {
        value: "⛈️",
        originalNumericCode: 96,
        description: "Thunderstorm with slight hail",
      };
    case 99:
      return {
        value: "⛈️🌨️",
        originalNumericCode: 99,
        description: "Thunderstorm with heavy hail",
      };
    default:
      return {
        value: "🤷‍♂️",
        originalNumericCode: -1,
        description: "Unknown weather code",
      };
  }
  // Unreachable, but TypeScript needs it
  return {
    value: "🤷‍♂️",
    originalNumericCode: weatherCode,
    description: "Unknown weather code",
  };
}

export function buildHourlyForecast(
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    is_day: number[];
  },
  unit: WeatherUnit,
  count = 6,
): HourlyForecastEntry[] {
  const now = Date.now();
  const result: HourlyForecastEntry[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const timestamp = new Date(hourly.time[i]).getTime();
    if (timestamp < now) continue;

    const daylight = hourly.is_day[i] === 1;
    const weatherInfo = openWeatherWMOToEmoji(hourly.weather_code[i], daylight);

    result.push({
      time: hourly.time[i],
      temperature: Math.round(hourly.temperature_2m[i]),
      weatherCode: hourly.weather_code[i],
      isDay: daylight,
      description: weatherInfo.description,
      icon: weatherInfo.value,
    });

    if (result.length >= count) break;
  }

  return result;
}

export function formatWeatherSummary(info: WeatherInfo): string {
  const base = `${info.icon}  ${info.temperature}°${info.unit}`;
  const desc = info.description ? ` • ${info.description}` : "";
  if (info.moonPhase) {
    return `${base}${desc} • ${info.moonPhase.name}`;
  }
  return `${base}${desc}`;
}

export function formatHourlySummary(info: WeatherInfo): string {
  if (!info.hourly.length) return "";
  const items = info.hourly
    .map((entry) => {
      const time = new Date(entry.time).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return `${time} ${entry.icon}  ${entry.temperature}°${info.unit}`;
    })
    .join(" · ");
  return items;
}

export function createWeatherErrorResult(
  message: string,
): AgentToolResult<{ weather?: WeatherInfo; error?: string }> {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    details: { error: message },
  };
}
