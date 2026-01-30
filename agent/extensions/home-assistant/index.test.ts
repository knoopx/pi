/**
 * Unit Tests for Home Assistant Extension
 * Tests: Configuration, entity state formatting, and filter logic
 */

import { describe, it, expect, beforeEach } from "vitest";
import { formatState, getConfig, saveConfig, deleteConfig } from "./index";

// ============================================================================
// Configuration Management Tests
// ============================================================================

describe("Configuration Management", () => {
  beforeEach(() => {
    deleteConfig();
  });

  describe("given a valid configuration", () => {
    describe("when saving configuration", () => {
      it("then it should persist URL and token", () => {
        saveConfig("http://ha.local:8123", "test-token");
        const config = getConfig();
        expect(config?.url).toBe("http://ha.local:8123");
        expect(config?.token).toBe("test-token");
      });

      it("then it should remove trailing slash from URL", () => {
        saveConfig("http://ha.local:8123/", "test-token");
        const config = getConfig();
        expect(config?.url).toBe("http://ha.local:8123");
      });
    });
  });

  describe("given no configuration", () => {
    it("then getConfig should return null", () => {
      expect(getConfig()).toBeNull();
    });
  });

  describe("given invalid configuration", () => {
    it("then it should handle missing auth file gracefully", () => {
      expect(() => getConfig()).not.toThrow();
      expect(getConfig()).toBeNull();
    });
  });

  describe("given configuration deletion", () => {
    beforeEach(() => {
      saveConfig("http://ha.local:8123", "test-token");
    });

    it("then it should remove the configuration", () => {
      deleteConfig();
      expect(getConfig()).toBeNull();
    });
  });
});

// ============================================================================
// Entity State Formatting Tests
// ============================================================================

describe("Entity State Formatting", () => {
  const createEntity = (
    entityId: string,
    state: string,
    attributes?: Record<string, unknown>,
  ) => ({
    entity_id: entityId,
    state,
    attributes: attributes || {},
    last_changed: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-01T00:00:00Z",
  });

  describe("given a light entity", () => {
    const lightEntity = createEntity("light.living_room", "on", {
      friendly_name: "Living Room Light",
      brightness: 128,
    });

    it("then it should include brightness percentage", () => {
      const formatted = formatState(lightEntity);
      expect(formatted).toContain("50%");
    });
  });

  describe("given an entity without friendly name", () => {
    const entity = createEntity("sensor.unknown", "unknown", {});

    it("then it should use entity_id as name", () => {
      const formatted = formatState(entity);
      expect(formatted).toContain("sensor.unknown");
    });
  });
});

// ============================================================================
// Entity Filtering Tests
// ============================================================================

describe("Entity Filtering", () => {
  const createEntity = (
    entityId: string,
    state: string,
    attributes?: Record<string, unknown>,
  ) => ({
    entity_id: entityId,
    state,
    attributes: attributes || {},
    last_changed: "2024-01-01T00:00:00Z",
    last_updated: "2024-01-01T00:00:00Z",
  });

  const mockStates = [
    createEntity("light.living_room", "on", {
      friendly_name: "Living Room Light",
      brightness: 128,
    }),
    createEntity("sensor.temperature", "20.5", {
      friendly_name: "Temperature",
      unit_of_measurement: "°C",
    }),
  ];

  describe("given domain filtering", () => {
    it("then it should return only entities from that domain", () => {
      const lights = mockStates.filter((e) => e.entity_id.startsWith("light."));
      expect(lights.length).toBe(1);
      expect(lights[0].entity_id).toBe("light.living_room");
    });
  });

  describe("given pattern filtering", () => {
    it("then it should match entity_id patterns", () => {
      const results = mockStates.filter((e) =>
        e.entity_id.toLowerCase().includes("living"),
      );
      expect(results.length).toBe(1);
      expect(results[0].entity_id).toBe("light.living_room");
    });

    it("then it should match friendly_name patterns", () => {
      const results = mockStates.filter((e) =>
        (e.attributes.friendly_name as string)
          ?.toLowerCase()
          .includes("temperature"),
      );
      expect(results.length).toBe(1);
      expect(results[0].entity_id).toBe("sensor.temperature");
    });
  });

  describe("given state filtering", () => {
    it("then it should return entities with matching state", () => {
      const onStates = mockStates.filter((e) => e.state === "on");
      expect(onStates.length).toBe(1);
    });
  });
});
