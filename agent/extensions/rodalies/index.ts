import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { SelectList, type SelectItem } from "@mariozechner/pi-tui";
import { SELECT_LIST_STYLES } from "../../shared/select-list-styles";
import { fuzzyFilter } from "../../shared/fuzzy";
import { throttledFetch } from "../../shared/throttle";
import { dotJoin, countLabel, table } from "../renderers";
import type { Column } from "../renderers";

// Cached stations to avoid repeated API calls
let cachedStations: Station[] | null = null;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
let cacheTimestamp = 0;

/** Reset cache state - exported for testing */
export function resetCache(): void {
  cachedStations = null;
  cacheTimestamp = 0;
}

/** Set cache state - exported for testing */
export function setCache(stations: Station[], timestamp?: number): void {
  cachedStations = stations;
  cacheTimestamp = timestamp ?? Date.now();
}

interface Station {
  id: number;
  name: string;
}

interface Train {
  departureDateHourSelectedStation: string;
  destinationStation: {
    name: string;
  };
  line: {
    name: string;
  };
  platformSelectedStation: string | null;
  delay: number;
  trainType: string;
  trainCancelled: boolean;
}

interface DepartureItem {
  departureTime: string;
  destination: string;
  line: string;
  platform: string;
  delay: number;
  trainType: string;
  cancelled: boolean;
}

/**
 * Fetch stations from Rodalies API, using cache if fresh
 * Now fetches all stations using a high limit
 */
export async function getStations(): Promise<Station[]> {
  const now = Date.now();

  if (cachedStations && now - cacheTimestamp < CACHE_EXPIRY) {
    return cachedStations;
  }

  try {
    // Fetch all stations using a high limit
    const response = await throttledFetch(
      "https://serveisgrs.rodalies.gencat.cat/api/stations?lang=en&limit=250",
    );
    const data = await response.json();

    // API returns stations in 'included' array, not 'items'
    const items =
      data.included && Array.isArray(data.included) ? data.included : [];
    const stations = items
      .filter(
        (station: { id: number | string; name: string }) =>
          station.id && station.name,
      )
      .map((station: { id: number | string; name: string }) => ({
        id: parseInt(String(station.id)),
        name: station.name,
      }));

    // Remove duplicates and sort alphabetically
    const uniqueStations = Array.from(
      new Map(stations.map((s: Station) => [s.id, s])).values(),
    ) as Station[];

    cacheTimestamp = now;
    cachedStations = uniqueStations.sort((a: Station, b: Station) =>
      a.name.localeCompare(b.name),
    );
    return uniqueStations;
  } catch (err) {
    console.error("Error fetching stations:", err);
    return [];
  }
}

/**
 * Get departures for a specific station
 */
async function getDepartures(stationId: number): Promise<DepartureItem[]> {
  try {
    const response = await throttledFetch(
      `https://serveisgrs.rodalies.gencat.cat/api/departures?stationId=${stationId}&minute=60&fullResponse=true&lang=en`,
    );
    const data = await response.json();

    if (data.trains && Array.isArray(data.trains)) {
      // Sort by departure time and take next 10
      const sorted = data.trains
        .sort(
          (a: Train, b: Train) =>
            new Date(a.departureDateHourSelectedStation).getTime() -
            new Date(b.departureDateHourSelectedStation).getTime(),
        )
        .slice(0, 10)
        .map(
          (train: Train): DepartureItem => ({
            departureTime: new Date(
              train.departureDateHourSelectedStation,
            ).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }),
            destination: train.destinationStation.name,
            line: train.line.name,
            platform: train.platformSelectedStation || "—",
            delay: train.delay,
            trainType: train.trainType,
            cancelled: train.trainCancelled,
          }),
        );

      return sorted;
    }
    return [];
  } catch (err) {
    console.error("Error fetching departures:", err);
    return [];
  }
}

export function formatDelayStatus(delay: number, cancelled: boolean): string {
  if (cancelled) return "✗ cancelled";
  if (delay === 0) return "● on time";
  if (delay > 0) return `▲ +${delay}min`;
  return `▼ ${delay}min`;
}

export function formatDeparturesOutput(
  _stationName: string,
  _stationId: number,
  departures: DepartureItem[],
): string {
  const cols: Column[] = [
    { key: "departs", align: "right" },
    { key: "line" },
    { key: "destination" },
    { key: "status", align: "right" },
  ];

  const rows = departures.map((dep) => ({
    departs: dep.departureTime,
    line: dep.line,
    destination: dep.destination,
    status: formatDelayStatus(dep.delay, dep.cancelled),
  }));

  return [
    dotJoin(countLabel(departures.length, "departure")),
    "",
    table(cols, rows),
  ].join("\n");
}

/**
 * Extension entry point
 */
export default function (pi: ExtensionAPI) {
  // Cache stations on session start
  pi.on("session_start", async (_event, _ctx) => {
    await getStations(); // Prime the cache
  });

  // Register custom tool to get departures
  pi.registerTool({
    name: "rodalies-departures",
    label: "Rodalies Departures",
    description:
      "Get real-time train departures for a station. Provide either stationId or stationName - the station ID will be automatically resolved if using a station name.",
    parameters: Type.Object({
      stationId: Type.Optional(Type.Integer()),
      stationName: Type.Optional(Type.String()),
    }),
    async execute(
      _toolCallId: string,
      params: {
        stationId?: number | undefined;
        stationName?: string | undefined;
      },
      _signal: AbortSignal | undefined,
      _onUpdate:
        | AgentToolUpdateCallback<
            { stationId: number; count: number } | undefined
          >
        | undefined,
      _ctx: ExtensionContext,
    ) {
      // Resolve station ID
      let stationId: number | undefined;
      let stationName: string | undefined;
      const stations = await getStations();

      if (params.stationId !== undefined) {
        stationId = params.stationId;
        const found = stations.find((s) => s.id === stationId);
        stationName = found?.name ?? String(stationId);
      } else if (params.stationName !== undefined) {
        stationName = params.stationName;
        const match = stations.find(
          (s) =>
            s.name.toLowerCase() === stationName!.toLowerCase() ||
            s.name.toLowerCase().includes(stationName!.toLowerCase()),
        );
        if (match) {
          stationId = match.id;
          stationName = match.name;
        } else {
          // Try fuzzy matching - find best match
          const matches = fuzzyFilter(stations, stationName, (s) => s.name);
          if (matches.length > 0) {
            stationId = matches[0].item.id;
            stationName = matches[0].item.name;
          }
        }
      }

      if (stationId === undefined) {
        const name = params.stationName;
        const stationList = stations
          .map((s) => `${s.name} (${s.id})`)
          .join(", ");
        return {
          content: [
            {
              type: "text",
              text: `Error: Station "${name}" not found.\n\nAvailable stations: ${stationList}`,
            },
          ],
          details: { error: `Station "${name}" not found` },
        } as unknown as AgentToolResult<
          { stationId: number; count: number } | undefined
        >;
      }

      // Get departures
      const departures = await getDepartures(stationId);

      // Format output
      if (departures.length === 0) {
        return {
          content: [
            { type: "text", text: "No departures found for this station." },
          ],
          details: { stationId, count: 0 },
        } as AgentToolResult<{ stationId: number; count: number } | undefined>;
      }

      const text = formatDeparturesOutput(stationName!, stationId, departures);

      return {
        content: [{ type: "text", text }],
        details: { stationId, count: departures.length },
      } as AgentToolResult<{ stationId: number; count: number } | undefined>;
    },
  });

  // Register command to interactively query departures
  pi.registerCommand("rodalies", {
    description: "Query Rodalies train departures",
    handler: async (args, ctx) => {
      // Use UI to select station
      const stations = await getStations();

      if (stations.length === 0) {
        ctx.ui.notify("Failed to load stations", "error");
        return;
      }

      // Create dropdown of stations
      const stationOptions: SelectItem[] = stations.map((s) => ({
        value: s.id.toString(),
        label: s.name,
      }));

      const selectList = new SelectList(stationOptions, 12, SELECT_LIST_STYLES);

      const selectedId = await new Promise<string | null>((resolve) => {
        (
          selectList as unknown as { onSelect: (item: SelectItem) => void }
        ).onSelect = (item: SelectItem) => {
          resolve(item.value);
        };
        (selectList as unknown as { onCancel: () => void }).onCancel = () => {
          resolve(null);
        };
        (
          ctx.ui as unknown as {
            custom: (widget: unknown, opts: unknown) => void;
          }
        ).custom(selectList, {
          overlay: true,
          overlayOptions: { width: 60 },
        });
      });

      if (!selectedId) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // Find station
      const station = stationOptions.find((opt) => opt.value === selectedId);
      if (!station) {
        ctx.ui.notify("Station not found", "error");
        return;
      }

      // Get departures directly
      const departures = await getDepartures(parseInt(station.value));

      if (departures.length === 0) {
        ctx.ui.notify("No departures found", "info");
        return;
      }

      // Show each departure
      departures.forEach((dep: DepartureItem) => {
        const status = formatDelayStatus(dep.delay, dep.cancelled);
        const message = `${dep.departureTime} → ${dep.destination} (${dep.line}) · Platform: ${dep.platform} · ${status}`;
        ctx.ui.notify(message, "info");
      });
    },
  });
}
