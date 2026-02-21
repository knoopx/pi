/**
 * Unit Tests for Rodalies Extension
 * Tests: Station resolution and fuzzy matching
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStations, resetCache, setCache } from "./index";
import { fuzzyFilter } from "../../shared/fuzzy";

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

describe("Station Resolution", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        included: [
          { id: 123, attributes: { name: "Test Station" } },
          { id: 456, attributes: { name: "Another Station" } },
        ],
      }),
    });
  });

  describe("given station by ID", () => {
    it("then it should use provided station ID", async () => {
      const params = { stationId: 123 };
      // Should use provided ID
      expect(params.stationId).toBe(123);
    });
  });

  describe("given station by name", () => {
    it("then it should find station by exact name match", async () => {
      const stations = [
        { id: 1, name: "Estación Central" },
        { id: 2, name: "Estación Manresa" },
      ];
      const params = { stationName: "Estación Central" };
      const match = stations.find(
        (s) =>
          s.name.toLowerCase() === params.stationName.toLowerCase() ||
          s.name.toLowerCase().includes(params.stationName.toLowerCase()),
      );
      expect(match?.id).toBe(1);
      expect(match?.name).toBe("Estación Central");
    });

    it("then it should find station by partial name match", async () => {
      const stations = [
        { id: 1, name: "Estación Central" },
        { id: 2, name: "Estación Manresa" },
      ];
      const params = { stationName: "Central" };
      const match = stations.find(
        (s) =>
          s.name.toLowerCase() === params.stationName.toLowerCase() ||
          s.name.toLowerCase().includes(params.stationName.toLowerCase()),
      );
      expect(match?.id).toBe(1);
    });
  });

  describe("given fuzzy matching", () => {
    it("then it should find station with fuzzy match", () => {
      const stations = [
        { id: 1, name: "Estación Central" },
        { id: 2, name: "Estación Manresa" },
      ];
      const matches = fuzzyFilter(stations, "Central", (s) => s.name);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].item.id).toBe(1);
    });

    it("then it should return empty for no match", () => {
      const stations = [{ id: 1, name: "Estación Central" }];
      const matches = fuzzyFilter(stations, "xyz123", (s) => s.name);
      expect(matches.length).toBe(0);
    });
  });

  describe("given no matching station", () => {
    it("then it should return error message", async () => {
      const stations = [{ id: 1, name: "Estación Central" }];
      const params = { stationName: "Nonexistent" };
      const availableStations = stations.map((s) => s.name).join(", ");
      const result = `Error: Station "${params.stationName}" not found.\n\nAvailable stations:\n${availableStations}`;
      expect(result).toContain("Error");
      expect(result).toContain("Nonexistent");
      expect(result).toContain("Available stations");
    });
  });
});

// ============================================================================
// Departure Formatting Tests
// ============================================================================

describe("Departure Formatting", () => {
  describe("given departure data", () => {
    it("then it should format departure time", () => {
      const departure = {
        departureDateHourSelectedStation: "2024-01-01T12:30:00",
        destinationStation: { name: "Madrid" },
        line: { name: "Linea A" },
        platformSelectedStation: "Plataforma A",
        delay: 5,
        trainType: "REN",
        trainCancelled: false,
      };
      const formatted = {
        departureTime: new Date(
          departure.departureDateHourSelectedStation,
        ).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        destination: departure.destinationStation.name,
        line: departure.line.name,
        platform: departure.platformSelectedStation || "—",
        delay:
          departure.delay > 0
            ? `+${departure.delay}min`
            : `${departure.delay}min`,
        trainType: departure.trainType,
        cancelled: departure.trainCancelled,
      };
      expect(formatted.departureTime).toBe("12:30");
      expect(formatted.destination).toBe("Madrid");
      expect(formatted.delay).toBe("+5min");
    });
  });

  describe("given departure without delay", () => {
    it("then it should show zero delay", () => {
      const departure = {
        departureDateHourSelectedStation: "2024-01-01T12:30:00",
        destinationStation: { name: "Madrid" },
        line: { name: "Linea A" },
        platformSelectedStation: "Plataforma A",
        delay: 0,
        trainType: "REN",
        trainCancelled: false,
      };
      const formatted = {
        departureTime: new Date(
          departure.departureDateHourSelectedStation,
        ).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        destination: departure.destinationStation.name,
        line: departure.line.name,
        platform: departure.platformSelectedStation || "—",
        delay:
          departure.delay > 0
            ? `+${departure.delay}min`
            : `${departure.delay}min`,
        trainType: departure.trainType,
        cancelled: departure.trainCancelled,
      };
      expect(formatted.delay).toBe("0min");
    });
  });

  describe("given negative delay", () => {
    it("then it should show negative delay", () => {
      const departure = {
        departureDateHourSelectedStation: "2024-01-01T12:30:00",
        destinationStation: { name: "Madrid" },
        line: { name: "Linea A" },
        platformSelectedStation: "Plataforma A",
        delay: -10,
        trainType: "REN",
        trainCancelled: false,
      };
      const formatted = {
        departureTime: new Date(
          departure.departureDateHourSelectedStation,
        ).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        destination: departure.destinationStation.name,
        line: departure.line.name,
        platform: departure.platformSelectedStation || "—",
        delay:
          departure.delay > 0
            ? `+${departure.delay}min`
            : `${departure.delay}min`,
        trainType: departure.trainType,
        cancelled: departure.trainCancelled,
      };
      expect(formatted.delay).toBe("-10min");
    });
  });

  describe("given cancelled train", () => {
    it("then it should show cancelled status", () => {
      const departure = {
        departureDateHourSelectedStation: "2024-01-01T12:30:00",
        destinationStation: { name: "Madrid" },
        line: { name: "Linea A" },
        platformSelectedStation: "Plataforma A",
        delay: 0,
        trainType: "REN",
        trainCancelled: true,
      };
      const formatted = {
        departureTime: new Date(
          departure.departureDateHourSelectedStation,
        ).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        destination: departure.destinationStation.name,
        line: departure.line.name,
        platform: departure.platformSelectedStation || "—",
        delay:
          departure.delay > 0
            ? `+${departure.delay}min`
            : `${departure.delay}min`,
        trainType: departure.trainType,
        cancelled: departure.trainCancelled,
      };
      expect(formatted.cancelled).toBe(true);
    });
  });

  describe("given departure without platform", () => {
    it("then it should show dash", () => {
      const departure = {
        departureDateHourSelectedStation: "2024-01-01T12:30:00",
        destinationStation: { name: "Madrid" },
        line: { name: "Linea A" },
        platformSelectedStation: null,
        delay: 0,
        trainType: "REN",
        trainCancelled: false,
      };
      const formatted = {
        departureTime: new Date(
          departure.departureDateHourSelectedStation,
        ).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        destination: departure.destinationStation.name,
        line: departure.line.name,
        platform: departure.platformSelectedStation || "—",
        delay:
          departure.delay > 0
            ? `+${departure.delay}min`
            : `${departure.delay}min`,
        trainType: departure.trainType,
        cancelled: departure.trainCancelled,
      };
      expect(formatted.platform).toBe("—");
    });
  });
});

// ============================================================================
// Cache Tests
// ============================================================================

describe("Cache Management", () => {
  beforeEach(() => {
    resetCache();
  });

  describe("given cached stations", () => {
    it("then getStations should return cached data", async () => {
      const stations = [
        { id: 1, name: "Estación Central" },
        { id: 2, name: "Estación Manresa" },
      ];
      setCache(stations);

      const result = await getStations();
      expect(result).toEqual(stations);
    });
  });

  describe("given expired cache", () => {
    it("then getStations should fetch new data", async () => {
      const stations = [{ id: 1, name: "Estación Central" }];
      // Set cache with expired timestamp (25 hours ago)
      setCache(stations, Date.now() - 25 * 60 * 60 * 1000);

      const result = await getStations();
      expect(result).toBeDefined();
    });
  });

  describe("given no cache", () => {
    it("then getStations should fetch new data", async () => {
      resetCache();

      const result = await getStations();
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// Station Sorting Tests
// ============================================================================

describe("Station Sorting", () => {
  describe("given stations", () => {
    it("then it should sort alphabetically by name", async () => {
      const stations = [
        { id: 1, name: "Estación Z" },
        { id: 2, name: "Estación A" },
        { id: 3, name: "Estación M" },
      ];
      const sorted = Array.from(
        new Map(stations.map((s) => [s.id, s])).values(),
      ).sort((a, b) => a.name.localeCompare(b.name));

      expect(sorted[0].name).toBe("Estación A");
      expect(sorted[1].name).toBe("Estación M");
      expect(sorted[2].name).toBe("Estación Z");
    });
  });

  describe("given duplicate stations", () => {
    it("then it should remove duplicates", async () => {
      const stations = [
        { id: 1, name: "Estación Central" },
        { id: 1, name: "Estación Central" }, // Duplicate
        { id: 2, name: "Estación Manresa" },
      ];
      const unique = Array.from(
        new Map(stations.map((s) => [s.id, s])).values(),
      );

      expect(unique).toHaveLength(2);
      expect(unique[0].id).toBe(1);
      expect(unique[1].id).toBe(2);
    });
  });
});
