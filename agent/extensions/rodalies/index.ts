import type {
	ExtensionAPI,
	ExtensionContext,
	AgentToolResult,
	AgentToolUpdateCallback,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { SelectList, type SelectItem } from "@mariozechner/pi-tui";

// Cached stations to avoid repeated API calls
export let cachedStations: Station[] | null = null;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
export let cacheTimestamp = 0;

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
	delay: string;
	trainType: string;
	cancelled: boolean;
}

/**
 * Levenshtein distance for fuzzy string matching
 */
export function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];
	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}
	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			const aChar = a.charAt(j - 1);
			const bChar = b.charAt(i - 1);
			if (bChar === aChar) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1,
				);
			}
		}
	}
	return matrix[b.length][a.length];
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
		const response = await fetch(
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
		return uniqueStations as Station[];
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
		const response = await fetch(
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
						delay: train.delay
							? train.delay > 0
								? `+${train.delay}min`
								: `${train.delay}min`
							: "",
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
		name: "rodalies_departures",
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
			const stations = await getStations();

			if (params.stationId !== undefined) {
				// Use provided station ID
				stationId = params.stationId;
			} else if (params.stationName !== undefined) {
				// Automatically find station ID from name
				const stationName = params.stationName;
				const match = stations.find(
					(s) =>
						s.name.toLowerCase() === stationName.toLowerCase() ||
						s.name.toLowerCase().includes(stationName.toLowerCase()),
				);
				if (match) {
					stationId = match.id;
				} else {
					// Try fuzzy matching - find best match
					const nameLower = stationName.toLowerCase();
					const bestMatch = stations.reduce(
						(best, current) => {
							const currentLower = current.name.toLowerCase();
							const nameDistance = levenshteinDistance(nameLower, currentLower);
							return nameDistance < (best?.distance || Infinity)
								? { station: current, distance: nameDistance }
								: best;
						},
						null as { station: Station; distance: number } | null,
					);

					if (bestMatch && bestMatch.distance <= 3) {
						stationId = bestMatch.station.id;
					}
				}
			}

			if (stationId === undefined) {
				// Try to provide more helpful error message
				const stationName = params.stationName;
				const availableStations = stations.map((s) => s.name).join(", ");
				return {
					content: [
						{
							type: "text",
							text: `Error: Station "${stationName}" not found.\n\nAvailable stations:\n${availableStations}`,
						},
					],
					details: { error: `Station "${stationName}" not found` },
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

			// Build response
			const formatted = departures.map((dep: DepartureItem) => ({
				departureTime: dep.departureTime,
				destination: dep.destination,
				line: dep.line,
				platform: dep.platform,
				delay: dep.delay,
				trainType: dep.trainType,
				cancelled: dep.cancelled,
			}));

			return {
				content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
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

			const selectList = new SelectList(stationOptions as any, 12, {
				selectedPrefix: (text: string) => `\x1b[32m>\x1b[0m ${text}`,
				selectedText: (text: string) => `\x1b[1m${text}\x1b[0m`,
				description: (text: string) => `\x1b[90m${text}\x1b[0m`,
				scrollInfo: (text: string) => `\x1b[90m${text}\x1b[0m`,
				noMatch: (text: string) => `\x1b[31m${text}\x1b[0m`,
			} as any) as any;

			// Use UI selection
			const selectedId = await new Promise<string | null>((resolve) => {
				selectList.onSelect = (item: any) => resolve(item.value);
				selectList.onCancel = () => resolve(null);
				(ctx as any).ui.custom(selectList, {
					overlay: true,
					overlayOptions: { width: 60 },
				} as any);
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
				const message = `🕒 ${dep.departureTime} → ${dep.destination} (${dep.line}) | Platform: ${dep.platform} ${dep.delay ? `| Delay: ${dep.delay}` : ""}`;
				ctx.ui.notify(message, "info");
			});
		},
	});
}
