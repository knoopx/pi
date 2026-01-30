import { WeatherInfo, WeatherUnit } from "./types";
import {
  openWeatherWMOToEmoji,
  moonPhaseAlt,
  buildHourlyForecast,
} from "./emoji";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function resolveLocation(
  latitude?: number,
  longitude?: number,
): Promise<{ latitude: number; longitude: number }> {
  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude };
  }

  const loc = await fetchJson<{ lat: number; lon: number }>(
    "http://ip-api.com/json?fields=lat,lon",
  );

  return { latitude: loc.lat, longitude: loc.lon };
}

export async function fetchWeather(
  latitude?: number,
  longitude?: number,
  unit: WeatherUnit = "C",
): Promise<WeatherInfo> {
  const location = await resolveLocation(latitude, longitude);
  const unitParam = unit === "F" ? "fahrenheit" : "celsius";
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", location.latitude.toString());
  url.searchParams.set("longitude", location.longitude.toString());
  url.searchParams.set("current", "temperature_2m,is_day,weather_code");
  url.searchParams.set("hourly", "temperature_2m,weather_code,is_day");
  url.searchParams.set("temperature_unit", unitParam);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("models", "gem_seamless");

  const weatherData = await fetchJson<{
    current: {
      temperature_2m: number;
      is_day: number;
      weather_code: number;
    };
    hourly: {
      time: string[];
      temperature_2m: number[];
      weather_code: number[];
      is_day: number[];
    };
  }>(url.toString());

  const weatherInfo = openWeatherWMOToEmoji(
    weatherData.current.weather_code,
    weatherData.current.is_day === 1,
  );
  const moon = weatherData.current.is_day === 1 ? undefined : moonPhaseAlt();

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    temperature: Math.round(weatherData.current.temperature_2m),
    unit,
    isDay: weatherData.current.is_day === 1,
    weatherCode: weatherData.current.weather_code,
    description: weatherInfo.description,
    icon: moon ? moon.icon : weatherInfo.value,
    moonPhase: moon ?? undefined,
    hourly: buildHourlyForecast(weatherData.hourly, unit),
  };
}
