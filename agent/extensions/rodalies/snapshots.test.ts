/**
 * Snapshot tests for Rodalies tool output formatting.
 */

import { describe, expect, it } from "vitest";
import { formatDelayStatus, formatDeparturesOutput } from "./index";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("rodalies output snapshots", () => {
  describe("formatDelayStatus", () => {
    it("renders all delay states", () => {
      expect([
        formatDelayStatus(0, false),
        formatDelayStatus(5, false),
        formatDelayStatus(-2, false),
        formatDelayStatus(0, true),
      ]).toEqual(["● on time", "▲ +5min", "▼ -2min", "✗ cancelled"]);
    });
  });

  describe("formatDeparturesOutput", () => {
    it("renders departures table", () => {
      const departures = [
        {
          departureTime: "08:15",
          destination: "Barcelona-Passeig de Gràcia",
          line: "R4",
          platform: "2",
          delay: 0,
          trainType: "Regional",
          cancelled: false,
        },
        {
          departureTime: "08:32",
          destination: "Manresa",
          line: "R4",
          platform: "1",
          delay: 5,
          trainType: "Regional",
          cancelled: false,
        },
        {
          departureTime: "08:45",
          destination: "Sant Vicenç de Calders",
          line: "R2",
          platform: "3",
          delay: 0,
          trainType: "Regional",
          cancelled: true,
        },
      ];

      expect(
        stripAnsi(formatDeparturesOutput("Estació Central", 123, departures)),
      ).toMatchSnapshot();
    });

    it("renders empty departures", () => {
      expect(stripAnsi(formatDeparturesOutput("Test Station", 1, []))).toBe(
        "0 departure(s)\n\n",
      );
    });
  });
});
