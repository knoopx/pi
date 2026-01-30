/**
 * iCal Extension - Calendar management via iCal URLs
 *
 * Provides tools to:
 * - List configured calendars
 * - List events from calendars (with recurring event expansion)
 * - View event details
 * - Filter events by date range
 * - Quick access to today/upcoming events
 *
 * Configuration: ~/.pi/agent/auth.json (ical-calendars key)
 * Cache: ~/.cache/pi/agent/extensions/ical/
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  expandRecurringEvent,
  async as icalAsync,
  type VEvent,
  type CalendarComponent,
  type CalendarResponse,
  type EventInstance,
  type Attendee,
} from "node-ical";

// Paths
const AUTH_PATH = path.join(os.homedir(), ".pi", "agent", "auth.json");
const CACHE_DIR = path.join(
  os.homedir(),
  ".cache",
  "pi",
  "agent",
  "extensions",
  "ical",
);

export { AUTH_PATH, CACHE_DIR };
export { parseRelativeDate, parseDateInput, sanitizeIcs };

// Test utilities (exported for testing purposes only)
export function saveCalendars(
  calendars: CalendarConfig[],
  customPath?: string,
  timezone?: string,
): void {
  let auth: Record<string, unknown> = {};
  try {
    if (fs.existsSync(customPath || AUTH_PATH)) {
      auth = JSON.parse(fs.readFileSync(customPath || AUTH_PATH, "utf-8"));
    }
  } catch {
    // Start fresh
  }
  const existing =
    (auth["ical-calendars"] as CalendarStore) ?? ({} as CalendarStore);
  const targetTimezone = timezone ?? existing.timezone;
  auth["ical-calendars"] = {
    ...existing,
    calendars,
    timezone: targetTimezone,
  } as CalendarStore;
  const filePath = customPath || AUTH_PATH;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(auth, null, 2));
}

export function loadCalendars(customPath?: string): CalendarConfig[] {
  const pathToUse = customPath || AUTH_PATH;
  try {
    if (!fs.existsSync(pathToUse)) return [];
    const auth = JSON.parse(fs.readFileSync(pathToUse, "utf-8"));
    const store = auth["ical-calendars"] as CalendarStore | undefined;
    return store?.calendars ?? [];
  } catch {
    return [];
  }
}

export function loadStore(customPath?: string): CalendarStore {
  const pathToUse = customPath || AUTH_PATH;
  try {
    if (!fs.existsSync(pathToUse)) return { calendars: [] };
    const auth = JSON.parse(fs.readFileSync(pathToUse, "utf-8"));
    const store = auth["ical-calendars"] as CalendarStore | undefined;
    return store ?? { calendars: [] };
  } catch {
    return { calendars: [] };
  }
}

export function saveCache(
  cacheDir: string,
  url: string,
  data: CalendarResponse,
): void {
  const cachePath = getCachePath(cacheDir, url);
  const cached: CachedCalendar = {
    url,
    fetchedAt: Date.now(),
    data,
  };
  fs.writeFileSync(cachePath, JSON.stringify(cached));
}

export function loadCache(
  cacheDir: string,
  url: string,
): CachedCalendar | null {
  const cachePath = getCachePath(cacheDir, url);
  try {
    if (!fs.existsSync(cachePath)) return null;
    const cached = JSON.parse(
      fs.readFileSync(cachePath, "utf-8"),
    ) as CachedCalendar;
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return null;
    return cached;
  } catch {
    return null;
  }
}

export function clearCache(cacheDir: string, url: string): void {
  const cachePath = getCachePath(cacheDir, url);
  try {
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  } catch {
    // Ignore
  }
}

export function getCachePath(cacheDir: string, url: string): string {
  const hash = Buffer.from(url).toString("base64url").slice(0, 32);
  return path.join(cacheDir, `${hash}.json`);
}

// Default timezone - can be overridden via config
const DEFAULT_TIMEZONE = "Europe/Madrid";

// Cache TTL - 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

// Types
export interface CalendarConfig {
  name: string;
  url: string;
  color?: string;
}

interface CalendarStore {
  calendars: CalendarConfig[];
  timezone?: string;
}

interface CachedCalendar {
  url: string;
  fetchedAt: number;
  data: CalendarResponse;
}

interface ParsedEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  status?: string;
  organizer?: string;
  attendees?: string[];
  calendarName: string;
}

// Parse relative dates like "today", "tomorrow", "this week"
function parseRelativeDate(input: string, tz: string): Date | null {
  const lower = input.toLowerCase().trim();
  const now = new Date();

  // Format date in timezone then parse back
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  const today = new Date(todayStr + "T00:00:00");

  switch (lower) {
    case "today":
      return today;
    case "tomorrow":
      return new Date(today.getTime() + 24 * 60 * 60 * 1000);
    case "yesterday":
      return new Date(today.getTime() - 24 * 60 * 60 * 1000);
    case "this week":
    case "week": {
      // Return start of week (Monday)
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Monday = 1
      return new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
    }
    case "next week": {
      const day = today.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      return new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
    }
    default:
      return null;
  }
}

// Parse date string - supports ISO dates and relative dates
function parseDateInput(
  input: string | undefined,
  tz: string,
  defaultDate?: Date,
): Date {
  if (!input) return defaultDate ?? new Date();

  const relative = parseRelativeDate(input, tz);
  if (relative) return relative;

  // Try ISO format
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed;

  return defaultDate ?? new Date();
}

function sanitizeIcs(data: string): string {
  const rawLines = data.split(/\r?\n/);
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  const output: string[] = [];
  let buffer: string[] = [];
  let inVEvent = false;

  const processEvent = (eventLines: string[]): string[] => {
    let dtstartType: "date" | "datetime" | null = null;
    let dtstartHasZ = false;

    for (const line of eventLines) {
      if (!line.startsWith("DTSTART")) continue;
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;
      const prefix = line.slice(0, colonIndex);
      const value = line.slice(colonIndex + 1).trim();
      const isDateOnly = /;VALUE=DATE/i.test(prefix) || /^\d{8}$/.test(value);
      dtstartType = isDateOnly ? "date" : "datetime";
      dtstartHasZ = value.endsWith("Z");
      break;
    }

    if (!dtstartType) return eventLines;

    return eventLines.map((line) => {
      if (!line.startsWith("RRULE")) return line;
      const untilMatch = line.match(/UNTIL=([^;]+)/i);
      if (!untilMatch) return line;

      const untilValue = untilMatch[1];
      const untilHasTime = untilValue.includes("T");
      let normalized = untilValue;

      if (dtstartType === "date" && untilHasTime) {
        normalized = untilValue.slice(0, 8);
      } else if (dtstartType === "datetime" && !untilHasTime) {
        normalized = `${untilValue}${dtstartHasZ ? "T000000Z" : "T000000"}`;
      }

      if (normalized === untilValue) return line;
      return line.replace(/UNTIL=([^;]+)/i, `UNTIL=${normalized}`);
    });
  };

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inVEvent = true;
      buffer = [line];
      continue;
    }

    if (inVEvent) {
      buffer.push(line);
      if (line.startsWith("END:VEVENT")) {
        output.push(...processEvent(buffer));
        buffer = [];
        inVEvent = false;
      }
      continue;
    }

    output.push(line);
  }

  if (buffer.length > 0) {
    output.push(...processEvent(buffer));
  }

  return output.join("\n");
}

function parseDate(date: unknown): string {
  if (!date) return "";
  if (date instanceof Date) return date.toISOString();
  if (typeof date === "string") return date;
  if (typeof date === "object" && "toISOString" in date) {
    return (date as { toISOString(): string }).toISOString();
  }
  return String(date);
}

function isAllDay(event: VEvent): boolean {
  const start = event.start;
  if (!start) return false;
  if ("dateOnly" in start && start.dateOnly) return true;
  if (typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start))
    return true;
  return false;
}

function parseAttendee(att: Attendee): string {
  if (typeof att === "string") {
    return att.replace(/^mailto:/i, "");
  }
  const email = att.val?.replace(/^mailto:/i, "") ?? "";
  const name = att.params?.CN;
  const status = att.params?.PARTSTAT;
  if (name && status) return `${name} (${status.toLowerCase()})`;
  if (name) return name;
  if (status) return `${email} (${status.toLowerCase()})`;
  return email;
}

function parseOrganizer(org: unknown): string | undefined {
  if (!org) return undefined;
  if (typeof org === "string") return org.replace(/^mailto:/i, "");
  if (typeof org === "object" && "val" in org) {
    const o = org as { val: string; params?: { CN?: string } };
    const email = o.val?.replace(/^mailto:/i, "") ?? "";
    return o.params?.CN ?? email;
  }
  return undefined;
}

function parseVEvent(event: VEvent, calendarName: string): ParsedEvent {
  let attendees: string[] | undefined;
  if (event.attendee) {
    const atts = Array.isArray(event.attendee)
      ? event.attendee
      : [event.attendee];
    attendees = atts.map(parseAttendee).filter(Boolean);
    if (attendees.length === 0) attendees = undefined;
  }

  return {
    uid: event.uid || "",
    summary: event.summary || "(No title)",
    description: event.description,
    location: event.location,
    start: parseDate(event.start),
    end: parseDate(event.end),
    allDay: isAllDay(event),
    recurring: !!event.rrule,
    status: event.status?.toLowerCase(),
    organizer: parseOrganizer(event.organizer),
    attendees,
    calendarName,
  };
}

function instanceToEvent(
  instance: EventInstance,
  calendarName: string,
): ParsedEvent {
  return {
    uid: instance.event.uid || "",
    summary: instance.summary || "(No title)",
    description: instance.event.description,
    location: instance.event.location,
    start: instance.start.toISOString(),
    end: instance.end.toISOString(),
    allDay: instance.isFullDay,
    recurring: instance.isRecurring,
    status: instance.event.status?.toLowerCase(),
    organizer: parseOrganizer(instance.event.organizer),
    attendees: instance.event.attendee
      ? (Array.isArray(instance.event.attendee)
          ? instance.event.attendee.filter(
              (a): a is Exclude<typeof a, undefined> => a !== undefined,
            )
          : [instance.event.attendee]
        ).map(parseAttendee)
      : undefined,
    calendarName,
  };
}

async function fetchCalendarData(url: string): Promise<CalendarResponse> {
  const cached = loadCache(CACHE_DIR, url);
  if (cached) return cached.data;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  const sanitized = sanitizeIcs(raw);
  const data = await icalAsync.parseICS(sanitized);

  saveCache(CACHE_DIR, url, data);
  return data;
}

function expandEventsInRange(
  data: CalendarResponse,
  calendarName: string,
  from: Date,
  to: Date,
): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  for (const key in data) {
    const component = data[key] as CalendarComponent;
    if (component.type !== "VEVENT") continue;

    const vevent = component as VEvent;

    if (vevent.rrule) {
      // Recurring event - expand instances
      try {
        const instances = expandRecurringEvent(vevent, {
          from,
          to,
          includeOverrides: true,
          excludeExdates: true,
          expandOngoing: true,
        });
        for (const instance of instances) {
          events.push(instanceToEvent(instance, calendarName));
        }
      } catch {
        // Fallback: just use base event if expansion fails
        events.push(parseVEvent(vevent, calendarName));
      }
    } else {
      // Non-recurring event - check if in range
      const eventStart = new Date(vevent.start);
      const eventEnd = vevent.end ? new Date(vevent.end) : eventStart;

      if (eventEnd >= from && eventStart <= to) {
        events.push(parseVEvent(vevent, calendarName));
      }
    }
  }

  return events;
}

async function fetchAndExpandCalendar(
  config: CalendarConfig,
  from: Date,
  to: Date,
): Promise<ParsedEvent[]> {
  const data = await fetchCalendarData(config.url);
  return expandEventsInRange(data, config.name, from, to);
}

function formatEventDate(dateStr: string, allDay: boolean, tz: string): string {
  const date = new Date(dateStr);
  if (allDay) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: tz,
    });
  }
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

function formatTimeOnly(dateStr: string, tz: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

function sortEventsByStart(events: ParsedEvent[]): ParsedEvent[] {
  return [...events].sort((a, b) => {
    const aStart = new Date(a.start).getTime();
    const bStart = new Date(b.start).getTime();
    return aStart - bStart;
  });
}

function formatEventLine(e: ParsedEvent, tz: string): string {
  const time = e.allDay
    ? "All day"
    : `${formatTimeOnly(e.start, tz)}–${formatTimeOnly(e.end, tz)}`;
  let line = `• ${time}: ${e.summary}`;
  if (e.location) line += ` @ ${e.location}`;
  if (e.status && e.status !== "confirmed") line += ` [${e.status}]`;
  if (e.recurring) line += " ↻";
  return line;
}

function groupEventsByDate(
  events: ParsedEvent[],
  tz: string,
): Map<string, ParsedEvent[]> {
  const grouped = new Map<string, ParsedEvent[]>();
  for (const event of events) {
    const dateKey = new Date(event.start).toLocaleDateString("en-CA", {
      timeZone: tz,
    });
    const existing = grouped.get(dateKey) ?? [];
    existing.push(event);
    grouped.set(dateKey, existing);
  }
  return grouped;
}

function formatDateHeader(dateStr: string, tz: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", {
    timeZone: tz,
  });

  let label = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });

  if (dateStr === today) label += " (Today)";
  else if (dateStr === tomorrow) label += " (Tomorrow)";

  return label;
}

export default function (pi: ExtensionAPI) {
  // Tool: ical_calendars - manage calendar list
  pi.registerTool({
    name: "ical_calendars",
    label: "iCal Calendars",
    description:
      "Manage iCal calendar subscriptions. Actions: list, add, remove",
    parameters: Type.Object({
      action: StringEnum(["list", "add", "remove"] as const),
      name: Type.Optional(
        Type.String({ description: "Calendar name (for add/remove)" }),
      ),
      url: Type.Optional(Type.String({ description: "iCal URL (for add)" })),
      color: Type.Optional(
        Type.String({ description: "Calendar color (for add, optional)" }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const calendars = loadCalendars();

      switch (params.action) {
        case "list": {
          if (calendars.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "No calendars configured. Use action 'add' to add one.",
                },
              ],
              details: { calendars: [] },
            };
          }
          const list = calendars
            .map((c) => `• ${c.name}${c.color ? ` (${c.color})` : ""}`)
            .join("\n");
          return {
            content: [{ type: "text", text: `Configured calendars:\n${list}` }],
            details: { calendars },
          };
        }

        case "add": {
          if (!params.name || !params.url) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: 'name' and 'url' are required for add",
                },
              ],
              details: { error: "missing parameters" },
              isError: true,
            };
          }
          if (calendars.some((c) => c.name === params.name)) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Calendar '${params.name}' already exists`,
                },
              ],
              details: { error: "duplicate name" },
              isError: true,
            };
          }
          const newCal: CalendarConfig = {
            name: params.name,
            url: params.url,
            color: params.color,
          };
          calendars.push(newCal);
          saveCalendars(calendars, undefined);
          return {
            content: [
              { type: "text", text: `Added calendar '${params.name}'` },
            ],
            details: { added: newCal, calendars },
          };
        }

        case "remove": {
          if (!params.name) {
            return {
              content: [
                { type: "text", text: "Error: 'name' is required for remove" },
              ],
              details: { error: "missing name" },
              isError: true,
            };
          }
          const idx = calendars.findIndex((c) => c.name === params.name);
          if (idx === -1) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: Calendar '${params.name}' not found`,
                },
              ],
              details: { error: "not found" },
              isError: true,
            };
          }
          const removed = calendars.splice(idx, 1)[0];
          saveCalendars(calendars, undefined);
          // Clear cache for removed calendar
          clearCache(CACHE_DIR, removed.url);
          return {
            content: [
              { type: "text", text: `Removed calendar '${params.name}'` },
            ],
            details: { removed, calendars },
          };
        }

        default:
          return {
            content: [
              { type: "text", text: `Unknown action: ${params.action}` },
            ],
            details: { error: "unknown action" },
            isError: true,
          };
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("ical_calendars "));
      text += theme.fg("muted", args.action);
      if (args.name) text += ` ${theme.fg("accent", args.name)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { calendars?: CalendarConfig[]; error?: string }
        | undefined;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      const text = result.content[0];
      return new Text(text?.type === "text" ? text.text : "", 0, 0);
    },
  });

  // Tool: ical_events - list and filter events
  pi.registerTool({
    name: "ical_events",
    label: "iCal Events",
    description:
      "List events from iCal calendars. Can filter by calendar name, date range (ISO format), and search text.",
    parameters: Type.Object({
      calendar: Type.Optional(
        Type.String({ description: "Calendar name to filter (omit for all)" }),
      ),
      from: Type.Optional(
        Type.String({
          description:
            "Start date (ISO format, e.g., 2024-01-01) or relative (today, tomorrow, this week)",
        }),
      ),
      to: Type.Optional(
        Type.String({
          description:
            "End date (ISO format, e.g., 2024-12-31) or relative (today, tomorrow)",
        }),
      ),
      search: Type.Optional(
        Type.String({ description: "Search text in summary/description" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Max events to return (default: 50)" }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const calendars = loadCalendars();
      const tz = DEFAULT_TIMEZONE;

      if (calendars.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No calendars configured. Use ical_calendars to add one.",
            },
          ],
          details: { events: [], count: 0 },
        };
      }

      // Filter calendars
      const targetCalendars = params.calendar
        ? calendars.filter(
            (c) => c.name.toLowerCase() === params.calendar?.toLowerCase(),
          )
        : calendars;

      if (targetCalendars.length === 0) {
        return {
          content: [
            { type: "text", text: `Calendar '${params.calendar}' not found` },
          ],
          details: { error: "calendar not found" },
          isError: true,
        };
      }

      // Parse date range - default to next 30 days if not specified
      const now = new Date();
      const defaultTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const from = parseDateInput(params.from, tz, now);
      const to = parseDateInput(params.to, tz, defaultTo);

      // Set end of day for 'to' if it looks like a date-only input
      if (params.to && !params.to.includes("T")) {
        to.setHours(23, 59, 59, 999);
      }

      // Fetch events from all target calendars in parallel
      const results = await Promise.allSettled(
        targetCalendars.map((cal) => fetchAndExpandCalendar(cal, from, to)),
      );

      let allEvents: ParsedEvent[] = [];
      const errors: string[] = [];

      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          allEvents = allEvents.concat(result.value);
        } else {
          const calName = targetCalendars[i].name;
          const errMsg =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          errors.push(`${calName}: ${errMsg}`);
        }
      });

      // Filter by search text
      if (params.search) {
        const search = params.search.toLowerCase();
        allEvents = allEvents.filter(
          (e) =>
            e.summary.toLowerCase().includes(search) ||
            e.description?.toLowerCase().includes(search) ||
            e.location?.toLowerCase().includes(search),
        );
      }

      // Sort by start date
      allEvents = sortEventsByStart(allEvents);

      // Apply limit
      const limit = params.limit ?? 50;
      const totalCount = allEvents.length;
      const events = allEvents.slice(0, limit);

      // Format output - group by date
      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text:
                errors.length > 0
                  ? `No events found. Errors: ${errors.join("; ")}`
                  : "No events found.",
            },
          ],
          details: { events: [], count: 0, errors },
        };
      }

      const grouped = groupEventsByDate(events, tz);
      const lines: string[] = [];

      for (const [dateStr, dayEvents] of Array.from(grouped.entries())) {
        lines.push(`\n📅 ${formatDateHeader(dateStr, tz)}`);
        for (const event of dayEvents) {
          lines.push(formatEventLine(event, tz));
        }
      }

      let output = lines.join("\n").trim();
      if (totalCount > limit) {
        output += `\n\n(Showing ${limit} of ${totalCount} events)`;
      }
      if (errors.length > 0) {
        output += `\n\n⚠️ Warnings: ${errors.join("; ")}`;
      }

      return {
        content: [{ type: "text", text: output }],
        details: { events, count: totalCount, shown: events.length, errors },
      };
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("ical_events"));
      if (args.calendar) text += ` ${theme.fg("accent", args.calendar)}`;
      if (args.from || args.to) {
        text += ` ${theme.fg("dim", `${args.from || "now"} → ${args.to || "..."}`)}`;
      }
      if (args.search) text += ` ${theme.fg("muted", `"${args.search}"`)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as
        | { events?: ParsedEvent[]; count?: number; error?: string }
        | undefined;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }

      const events = details?.events ?? [];
      const count = details?.count ?? 0;
      const tz = DEFAULT_TIMEZONE;

      if (events.length === 0) {
        return new Text(theme.fg("dim", "No events found"), 0, 0);
      }

      let text = theme.fg("muted", `${count} event(s)`);
      const display = expanded ? events : events.slice(0, 5);

      for (const e of display) {
        const date = formatEventDate(e.start, e.allDay, tz);
        text += `\n${theme.fg("dim", date)} ${theme.fg("text", e.summary)}`;
        if (e.location) text += ` ${theme.fg("muted", `@ ${e.location}`)}`;
        if (e.recurring) text += theme.fg("dim", " ↻");
      }

      if (!expanded && events.length > 5) {
        text += `\n${theme.fg("dim", `... ${events.length - 5} more`)}`;
      }

      return new Text(text, 0, 0);
    },
  });

  // Tool: ical_event - get single event details
  pi.registerTool({
    name: "ical_event",
    label: "iCal Event",
    description:
      "Get details of a specific event by UID or search for an event by summary text",
    parameters: Type.Object({
      uid: Type.Optional(Type.String({ description: "Event UID" })),
      summary: Type.Optional(
        Type.String({ description: "Event summary to search for" }),
      ),
      calendar: Type.Optional(
        Type.String({ description: "Calendar name to search in" }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      if (!params.uid && !params.summary) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Either 'uid' or 'summary' is required",
            },
          ],
          details: { error: "missing parameters" },
          isError: true,
        };
      }

      const calendars = loadCalendars();
      const tz = DEFAULT_TIMEZONE;
      const targetCalendars = params.calendar
        ? calendars.filter(
            (c) => c.name.toLowerCase() === params.calendar?.toLowerCase(),
          )
        : calendars;

      if (targetCalendars.length === 0) {
        return {
          content: [
            { type: "text", text: `Calendar '${params.calendar}' not found` },
          ],
          details: { error: "calendar not found" },
          isError: true,
        };
      }

      // Search for event - look in next year of events
      const from = new Date();
      const to = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000);

      let foundEvent: ParsedEvent | null = null;

      for (const cal of targetCalendars) {
        try {
          const events = await fetchAndExpandCalendar(cal, from, to);
          if (params.uid) {
            foundEvent = events.find((e) => e.uid === params.uid) ?? null;
          } else if (params.summary) {
            const search = params.summary.toLowerCase();
            foundEvent =
              events.find((e) => e.summary.toLowerCase().includes(search)) ??
              null;
          }
          if (foundEvent) break;
        } catch {
          // Continue to next calendar
        }
      }

      if (!foundEvent) {
        return {
          content: [{ type: "text", text: "Event not found" }],
          details: { error: "not found" },
          isError: true,
        };
      }

      const lines: string[] = [
        `📅 ${foundEvent.summary}`,
        `Calendar: ${foundEvent.calendarName}`,
        `Start: ${formatEventDate(foundEvent.start, foundEvent.allDay, tz)}`,
        `End: ${formatEventDate(foundEvent.end, foundEvent.allDay, tz)}`,
      ];

      if (foundEvent.location)
        lines.push(`📍 Location: ${foundEvent.location}`);
      if (foundEvent.status && foundEvent.status !== "confirmed") {
        lines.push(`Status: ${foundEvent.status}`);
      }
      if (foundEvent.organizer)
        lines.push(`Organizer: ${foundEvent.organizer}`);
      if (foundEvent.attendees?.length) {
        lines.push(`Attendees: ${foundEvent.attendees.join(", ")}`);
      }
      if (foundEvent.description) {
        lines.push(`\nDescription:\n${foundEvent.description}`);
      }
      if (foundEvent.recurring) lines.push(`↻ Recurring event`);
      lines.push(`UID: ${foundEvent.uid}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: { event: foundEvent },
      };
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("ical_event"));
      if (args.uid)
        text += ` ${theme.fg("accent", args.uid.slice(0, 20) + "...")}`;
      if (args.summary) text += ` ${theme.fg("muted", `"${args.summary}"`)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { event?: ParsedEvent; error?: string }
        | undefined;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }

      const event = details?.event;
      const tz = DEFAULT_TIMEZONE;
      if (!event) {
        return new Text(theme.fg("dim", "No event"), 0, 0);
      }

      let text = theme.fg("accent", `📅 ${event.summary}`);
      text += `\n${theme.fg("dim", formatEventDate(event.start, event.allDay, tz))}`;
      if (event.location)
        text += `\n${theme.fg("muted", `📍 ${event.location}`)}`;

      return new Text(text, 0, 0);
    },
  });

  // Tool: ical_refresh - force refresh cache
  pi.registerTool({
    name: "ical_refresh",
    label: "iCal Refresh",
    description: "Force refresh the calendar cache",
    parameters: Type.Object({
      calendar: Type.Optional(
        Type.String({ description: "Calendar name (omit for all)" }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const calendars = loadCalendars();
      const targetCalendars = params.calendar
        ? calendars.filter(
            (c) => c.name.toLowerCase() === params.calendar?.toLowerCase(),
          )
        : calendars;

      if (targetCalendars.length === 0) {
        if (params.calendar) {
          return {
            content: [
              { type: "text", text: `Calendar '${params.calendar}' not found` },
            ],
            details: { error: "not found" },
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: "No calendars configured" }],
          details: { refreshed: [] },
        };
      }

      // Clear cache for target calendars
      for (const cal of targetCalendars) {
        clearCache(CACHE_DIR, cal.url);
      }

      // Re-fetch in parallel
      const results = await Promise.allSettled(
        targetCalendars.map((cal) => fetchCalendarData(cal.url)),
      );

      const refreshed: string[] = [];
      const errors: string[] = [];

      results.forEach((result, i) => {
        const calName = targetCalendars[i].name;
        if (result.status === "fulfilled") {
          refreshed.push(calName);
        } else {
          const errMsg =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          errors.push(`${calName}: ${errMsg}`);
        }
      });

      let output = `✓ Refreshed: ${refreshed.join(", ") || "none"}`;
      if (errors.length > 0) {
        output += `\n⚠️ Errors: ${errors.join("; ")}`;
      }

      return {
        content: [{ type: "text", text: output }],
        details: { refreshed, errors },
      };
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("ical_refresh"));
      if (args.calendar) text += ` ${theme.fg("accent", args.calendar)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as
        | { refreshed?: string[]; error?: string }
        | undefined;
      if (details?.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }
      const refreshed = details?.refreshed ?? [];
      return new Text(
        theme.fg("success", `✓ Refreshed ${refreshed.length} calendar(s)`),
        0,
        0,
      );
    },
  });

  // Command: /calendars - quick view of calendars
  pi.registerCommand("calendars", {
    description: "List configured iCal calendars",
    handler: async (_args, ctx) => {
      const calendars = loadCalendars();
      if (calendars.length === 0) {
        ctx.ui.notify(
          "No calendars configured. Use the ical_calendars tool to add one.",
          "info",
        );
        return;
      }
      const list = calendars.map((c) => c.name).join(", ");
      ctx.ui.notify(`Calendars: ${list}`, "info");
    },
  });

  // Command: /today - quick view of today's events
  pi.registerCommand("today", {
    description: "Show today's calendar events",
    handler: async (_args, ctx) => {
      const calendars = loadCalendars();
      if (calendars.length === 0) {
        ctx.ui.notify("No calendars configured.", "info");
        return;
      }

      const tz = DEFAULT_TIMEZONE;
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const from = new Date(todayStr + "T00:00:00");
      const to = new Date(todayStr + "T23:59:59");

      let allEvents: ParsedEvent[] = [];
      for (const cal of calendars) {
        try {
          const events = await fetchAndExpandCalendar(cal, from, to);
          allEvents = allEvents.concat(events);
        } catch {
          // Skip failed calendars
        }
      }

      if (allEvents.length === 0) {
        ctx.ui.notify("No events today! 🎉", "info");
        return;
      }

      allEvents = sortEventsByStart(allEvents);
      const lines = allEvents.map((e) => formatEventLine(e, tz)).slice(0, 5);
      const more =
        allEvents.length > 5 ? `\n... and ${allEvents.length - 5} more` : "";
      ctx.ui.notify(`Today's events:\n${lines.join("\n")}${more}`, "info");
    },
  });
}
