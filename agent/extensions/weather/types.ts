export type { AgentToolResult } from "@mariozechner/pi-coding-agent";

export enum EMoonPhase {
  New = 0,
  WaxingCrescent,
  QuarterMoon,
  WaxingGibbous,
  Full,
  WaningGibbous,
  LastQuarter,
  WaningCrescent,
  COUNT = 8,
}

export const moonIcons: [
  New: string,
  WaxingCrescent: string,
  QuarterMoon: string,
  WaxingGibbous: string,
  Full: string,
  WaningGibbous: string,
  LastQuarter: string,
  WaningCrescent: string,
] = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

export enum EMoonPhaseName {
  New = "New",
  WaxingCrescent = "Waxing Crescent",
  QuarterMoon = "Quarter Moon",
  WaxingGibbous = "Waxing Gibbous",
  Full = "Full",
  WaningGibbous = "Waning Gibbous",
  LastQuarter = "Last Quarter",
  WaningCrescent = "Waning Crescent",
  COUNT = "COUNT",
}

export const MOON_PHASE_NAMES: EMoonPhaseName[] = [
  EMoonPhaseName.New,
  EMoonPhaseName.WaxingCrescent,
  EMoonPhaseName.QuarterMoon,
  EMoonPhaseName.WaxingGibbous,
  EMoonPhaseName.Full,
  EMoonPhaseName.WaningGibbous,
  EMoonPhaseName.LastQuarter,
  EMoonPhaseName.WaningCrescent,
  EMoonPhaseName.COUNT,
];

export interface MoonPhaseResult {
  name: EMoonPhaseName;
  phase: EMoonPhase;
  icon: string;
}

export interface HourlyForecastEntry {
  time: string;
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  description: string;
  icon: string;
}

export interface WeatherInfo {
  latitude: number;
  longitude: number;
  temperature: number;
  unit: "C" | "F";
  isDay: boolean;
  weatherCode: number;
  description: string;
  icon: string;
  moonPhase?: MoonPhaseResult;
  hourly: HourlyForecastEntry[];
}

export type WeatherUnit = "C" | "F";
