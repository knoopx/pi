/**
 * Snapshot tests for Home Assistant tool output formatting.
 */

import { describe, expect, it } from "vitest";
import { formatState, formatStateDetails } from "./index";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

function entity(
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HAState {
  return {
    entity_id: id,
    state,
    attributes,
    last_changed: "2026-03-08T07:00:00Z",
    last_updated: "2026-03-08T07:00:00Z",
  };
}

describe("home-assistant output snapshots", () => {
  describe("formatState", () => {
    it("renders light on with brightness", () => {
      expect(
        formatState(
          entity("light.living_room", "on", {
            friendly_name: "Living Room Light",
            brightness: 128,
          }),
        ),
      ).toBe("● Living Room Light: on (50%)");
    });

    it("renders light off", () => {
      expect(
        formatState(
          entity("light.bedroom", "off", {
            friendly_name: "Bedroom Light",
          }),
        ),
      ).toBe("○ Bedroom Light: off");
    });

    it("renders climate entity", () => {
      expect(
        formatState(
          entity("climate.thermostat", "heat", {
            friendly_name: "Thermostat",
            temperature: 22,
            current_temperature: 19.5,
          }),
        ),
      ).toBe("Thermostat: heat 19.5° → 22°");
    });

    it("renders sensor with unit", () => {
      expect(
        formatState(
          entity("sensor.temperature", "20.5", {
            friendly_name: "Temperature",
            unit_of_measurement: "°C",
          }),
        ),
      ).toBe("Temperature: 20.5 °C");
    });

    it("renders unavailable entity", () => {
      expect(
        formatState(
          entity("sensor.offline", "unavailable", {
            friendly_name: "Offline Sensor",
          }),
        ),
      ).toBe("○ Offline Sensor: unavailable");
    });

    it("renders entity without friendly_name", () => {
      expect(formatState(entity("switch.unknown", "on", {}))).toBe(
        "● switch.unknown: on",
      );
    });
  });

  describe("formatStateDetails", () => {
    it("renders full entity detail view", () => {
      expect(
        stripAnsi(
          formatStateDetails(
            entity("light.kitchen", "on", {
              friendly_name: "Kitchen Light",
              brightness: 255,
              color_mode: "brightness",
              supported_color_modes: ["brightness"],
            }),
          ),
        ),
      ).toMatchSnapshot();
    });

    it("renders sensor detail view", () => {
      expect(
        stripAnsi(
          formatStateDetails(
            entity("sensor.humidity", "65", {
              friendly_name: "Humidity",
              unit_of_measurement: "%",
              device_class: "humidity",
            }),
          ),
        ),
      ).toMatchSnapshot();
    });
  });
});
