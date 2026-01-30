/**
 * Home Assistant Extension - List and toggle entities via the Home Assistant API
 *
 * Configure via:
 *   /home-assistant - Interactive setup for URL and token
 *
 * Provides tools:
 *   - ha_list_entities: List all entities (optionally filtered by domain/pattern)
 *   - ha_get_state: Get state of a specific entity
 *   - ha_toggle: Toggle an entity (light, switch, etc.)
 *   - ha_turn_on: Turn on an entity
 *   - ha_turn_off: Turn off an entity
 *   - ha_call_service: Call unknown HA service
 *
 * Provides commands:
 *   /home-assistant - Configure Home Assistant connection
 *   /ha - Interactive entity browser and toggle UI
 */

import type {
  ExtensionAPI,
  AgentToolResult,
  ToolRenderResultOptions,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Types for Home Assistant API responses
interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

interface HAServiceResponse {
  context: { id: string };
}

// Config stored in auth.json
interface HAConfig {
  type: "home_assistant";
  url: string;
  token: string;
}

// Auth file path
const AUTH_FILE = path.join(os.homedir(), ".pi", "agent", "auth.json");

// Load auth.json
function loadAuth(): Record<string, unknown> {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

// Save auth.json
function saveAuth(auth: Record<string, unknown>): void {
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
}

// Get HA config from auth.json
function getConfig(): { url: string; token: string } | null {
  const auth = loadAuth();
  const config = auth["home-assistant"] as HAConfig | undefined;
  if (config?.type === "home_assistant" && config.url && config.token) {
    return { url: config.url.replace(/\/$/, ""), token: config.token };
  }
  return null;
}

// Save HA config to auth.json
function saveConfig(url: string, token: string): void {
  const auth = loadAuth();
  auth["home-assistant"] = {
    type: "home_assistant",
    url: url.replace(/\/$/, ""),
    token,
  };
  saveAuth(auth);
}

// Delete HA config from auth.json
function deleteConfig(): void {
  const auth = loadAuth();
  delete auth["home-assistant"];
  saveAuth(auth);
}

// Helper for HA API requests
async function haFetch<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Home Assistant not configured. Run /home-assistant to set up.",
    );
  }

  const response = await fetch(`${config.url}/api${endpoint}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Home Assistant API error: ${response.status} ${response.statusText} - ${text}`,
    );
  }

  return response.json() as Promise<T>;
}

// Format entity state for display
function formatState(entity: HAState): string {
  const domain = entity.entity_id.split(".")[0];
  const name = entity.attributes.friendly_name || entity.entity_id;
  let stateStr = entity.state;

  // Add relevant attributes based on domain
  if (domain === "light" && entity.state === "on") {
    const brightness = entity.attributes.brightness as number | undefined;
    if (brightness !== undefined) {
      stateStr += ` (${Math.round((brightness / 255) * 100)}%)`;
    }
  } else if (domain === "climate") {
    const temp = entity.attributes.temperature as number | undefined;
    const currentTemp = entity.attributes.current_temperature as
      | number
      | undefined;
    if (currentTemp !== undefined) stateStr += ` ${currentTemp}°`;
    if (temp !== undefined) stateStr += ` → ${temp}°`;
  } else if (domain === "sensor") {
    const unit = entity.attributes.unit_of_measurement as string | undefined;
    if (unit) stateStr += ` ${unit}`;
  }

  return `${name}: ${stateStr}`;
}

export default function homeAssistantExtension(pi: ExtensionAPI) {
  // Command: Configure Home Assistant
  pi.registerCommand("home-assistant", {
    description: "Configure Home Assistant connection",
    handler: async (_args, ctx) => {
      const currentConfig = getConfig();

      if (currentConfig) {
        // Already configured - offer options
        const options = [
          "Test Connection",
          "Reconfigure",
          "Remove Configuration",
          "Cancel",
        ];
        const choice = await ctx.ui.select(
          `Home Assistant configured: ${currentConfig.url}`,
          options,
        );

        if (choice === undefined || choice === "Cancel") return;

        if (choice === "Test Connection") {
          // Test connection
          try {
            const result = await fetch(`${currentConfig.url}/api/`, {
              headers: { Authorization: `Bearer ${currentConfig.token}` },
            });
            if (result.ok) {
              const data = (await result.json()) as { message?: string };
              ctx.ui.notify(`✓ Connected: ${data.message || "OK"}`, "info");
            } else {
              ctx.ui.notify(
                `✗ Connection failed: ${result.status} ${result.statusText}`,
                "error",
              );
            }
          } catch (error) {
            ctx.ui.notify(
              `✗ Connection failed: ${(error as Error).message}`,
              "error",
            );
          }
          return;
        }

        if (choice === "Remove Configuration") {
          // Remove configuration
          const confirm = await ctx.ui.confirm(
            "Remove Configuration",
            "Are you sure you want to remove Home Assistant configuration?",
          );
          if (confirm) {
            deleteConfig();
            ctx.ui.notify("Home Assistant configuration removed", "info");
          }
          return;
        }

        // choice === "Reconfigure": fall through to setup
      }

      // Setup new configuration
      const url = await ctx.ui.input(
        "Home Assistant URL",
        currentConfig?.url || "http://homeassistant.local:8123",
      );
      if (!url) {
        ctx.ui.notify("Setup cancelled", "warning");
        return;
      }

      const token = await ctx.ui.input(
        "Long-Lived Access Token (Profile → Security → Long-Lived Access Tokens)",
        "",
      );
      if (!token) {
        ctx.ui.notify("Setup cancelled", "warning");
        return;
      }

      // Test the connection before saving
      try {
        const testUrl = url.replace(/\/$/, "");
        const result = await fetch(`${testUrl}/api/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!result.ok) {
          ctx.ui.notify(
            `Connection failed: ${result.status} ${result.statusText}`,
            "error",
          );
          return;
        }
      } catch (error) {
        ctx.ui.notify(
          `Connection failed: ${(error as Error).message}`,
          "error",
        );
        return;
      }

      // Save configuration
      saveConfig(url, token);
      ctx.ui.notify("✓ Home Assistant configured successfully!", "info");
    },
  });

  // Tool: List entities
  pi.registerTool({
    name: "ha_list_entities",
    label: "HA List Entities",
    description:
      "List Home Assistant entities. Can filter by domain (e.g., 'light', 'switch', 'sensor') or by a pattern that matches entity_id or friendly_name.",
    parameters: Type.Object({
      domain: Type.Optional(
        Type.String({
          description:
            "Filter by domain (e.g., light, switch, sensor, climate)",
        }),
      ),
      pattern: Type.Optional(
        Type.String({
          description: "Filter by pattern matching entity_id or friendly_name",
        }),
      ),
      state: Type.Optional(
        Type.String({
          description: "Filter by state (e.g., 'on', 'off', 'unavailable')",
        }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      try {
        const states = await haFetch<HAState[]>("/states");
        let filtered = states;

        // Filter by domain
        if (params.domain) {
          const domain = params.domain.toLowerCase();
          filtered = filtered.filter((e) =>
            e.entity_id.startsWith(`${domain}.`),
          );
        }

        // Filter by pattern
        if (params.pattern) {
          const pattern = params.pattern.toLowerCase();
          filtered = filtered.filter(
            (e) =>
              e.entity_id.toLowerCase().includes(pattern) ||
              (e.attributes.friendly_name as string | undefined)
                ?.toLowerCase()
                .includes(pattern),
          );
        }

        // Filter by state
        if (params.state) {
          const state = params.state.toLowerCase();
          filtered = filtered.filter((e) => e.state.toLowerCase() === state);
        }

        // Sort by entity_id
        filtered.sort((a, b) => a.entity_id.localeCompare(b.entity_id));

        // Format output
        const lines = filtered.map((e) => {
          const name = e.attributes.friendly_name || e.entity_id;
          return `- ${e.entity_id} (${name}): ${e.state}`;
        });

        const summary = `Found ${filtered.length} entities${params.domain ? ` in domain '${params.domain}'` : ""}${params.pattern ? ` matching '${params.pattern}'` : ""}${params.state ? ` with state '${params.state}'` : ""}`;

        return {
          content: [
            { type: "text", text: `${summary}\n\n${lines.join("\n")}` },
          ],
          details: {
            count: filtered.length,
            entities: filtered.map((e) => e.entity_id),
          },
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          details: { error: (error as Error).message },
        };
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("ha_list_entities"));
      if (args.domain) text += ` domain=${theme.fg("accent", args.domain)}`;
      if (args.pattern)
        text += ` pattern=${theme.fg("accent", `"${args.pattern}"`)}`;
      if (args.state) text += ` state=${theme.fg("accent", args.state)}`;
      return new Text(text, 0, 0);
    },
  });

  // Tool: Get entity state
  pi.registerTool({
    name: "ha_get_state",
    label: "HA Get State",
    description:
      "Get the current state and attributes of a specific Home Assistant entity.",
    parameters: Type.Object({
      entity_id: Type.String({
        description: "Entity ID (e.g., light.living_room)",
      }),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      try {
        const state = await haFetch<HAState>(`/states/${params.entity_id}`);

        const output = [
          `Entity: ${state.entity_id}`,
          `State: ${state.state}`,
          `Last changed: ${state.last_changed}`,
          `Attributes:`,
          ...Object.entries(state.attributes).map(
            ([k, v]) => `  ${k}: ${JSON.stringify(v)}`,
          ),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
          details: state,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          details: { error: message },
        };
      }
    },

    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("ha_get_state"))} ${theme.fg("accent", args.entity_id)}`,
        0,
        0,
      );
    },
  });

  // Tool: Toggle entity
  pi.registerTool({
    name: "ha_toggle",
    label: "HA Toggle",
    description:
      "Toggle a Home Assistant entity (works with lights, switches, fans, covers, etc.). If on, turns off. If off, turns on.",
    parameters: Type.Object({
      entity_id: Type.String({
        description: "Entity ID to toggle (e.g., light.living_room)",
      }),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      try {
        const domain = params.entity_id.split(".")[0];
        await haFetch<HAServiceResponse[]>(`/services/${domain}/toggle`, {
          method: "POST",
          body: { entity_id: params.entity_id },
        });

        // Get new state
        const newState = await haFetch<HAState>(`/states/${params.entity_id}`);

        return {
          content: [
            {
              type: "text",
              text: `Toggled ${params.entity_id} → ${newState.state}`,
            },
          ],
          details: { entity_id: params.entity_id, new_state: newState.state },
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          details: { error: (error as Error).message },
        };
      }
    },

    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("ha_toggle"))} ${theme.fg("warning", args.entity_id)}`,
        0,
        0,
      );
    },

    renderResult(
      result: AgentToolResult<unknown>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ): Text {
      const details = result.details as
        | { error?: string }
        | { new_state?: string }
        | { entity_id?: string; new_state?: string };
      if ("error" in details && details.error !== undefined) {
        return new Text(
          theme.fg(
            "error",
            (result.content[0] as { type: string; text: string })?.text ||
              "Error",
          ),
          0,
          0,
        );
      }
      const state =
        "new_state" in details && details.new_state !== undefined
          ? details.new_state
          : undefined;
      const stateColor = state === "on" ? "success" : "muted";
      return new Text(
        `${theme.fg("success", "✓")} ${theme.fg(stateColor, (result.content[0] as { type: string; text: string })?.text || "Done")}`,
        0,
        0,
      );
    },
  });

  // Tool: Turn on
  pi.registerTool({
    name: "ha_turn_on",
    label: "HA Turn On",
    description:
      "Turn on a Home Assistant entity. Supports optional parameters for lights (brightness, color, etc.).",
    parameters: Type.Object({
      entity_id: Type.String({ description: "Entity ID to turn on" }),
      brightness_pct: Type.Optional(
        Type.Number({
          description: "Brightness percentage (0-100) for lights",
        }),
      ),
      color_name: Type.Optional(
        Type.String({ description: "Color name for lights (e.g., red, blue)" }),
      ),
      rgb_color: Type.Optional(
        Type.Array(Type.Number(), {
          description: "RGB color as [r, g, b] array",
        }),
      ),
      temperature: Type.Optional(
        Type.Number({ description: "Target temperature for climate entities" }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      try {
        const domain = params.entity_id.split(".")[0];
        const serviceData: Record<string, unknown> = {
          entity_id: params.entity_id,
        };

        // Add optional parameters
        if (params.brightness_pct !== undefined) {
          serviceData.brightness_pct = params.brightness_pct;
        }
        if (params.color_name) {
          serviceData.color_name = params.color_name;
        }
        if (params.rgb_color) {
          serviceData.rgb_color = params.rgb_color;
        }
        if (params.temperature !== undefined) {
          serviceData.temperature = params.temperature;
        }

        await haFetch<HAServiceResponse[]>(`/services/${domain}/turn_on`, {
          method: "POST",
          body: serviceData,
        });

        // Get new state
        const newState = await haFetch<HAState>(`/states/${params.entity_id}`);

        return {
          content: [
            {
              type: "text",
              text: `Turned on ${params.entity_id}: ${formatState(newState)}`,
            },
          ],
          details: { entity_id: params.entity_id, state: newState },
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          details: { error: (error as Error).message },
        };
      }
    },

    renderCall(args, theme) {
      let text = `${theme.fg("toolTitle", theme.bold("ha_turn_on"))} ${theme.fg("success", args.entity_id)}`;
      if (args.brightness_pct !== undefined)
        text += ` ${theme.fg("muted", `${args.brightness_pct}%`)}`;
      if (args.color_name) text += ` ${theme.fg("muted", args.color_name)}`;
      return new Text(text, 0, 0);
    },
  });

  // Tool: Turn off
  pi.registerTool({
    name: "ha_turn_off",
    label: "HA Turn Off",
    description: "Turn off a Home Assistant entity.",
    parameters: Type.Object({
      entity_id: Type.String({ description: "Entity ID to turn off" }),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      try {
        const domain = params.entity_id.split(".")[0];
        await haFetch<HAServiceResponse[]>(`/services/${domain}/turn_off`, {
          method: "POST",
          body: { entity_id: params.entity_id },
        });

        return {
          content: [{ type: "text", text: `Turned off ${params.entity_id}` }],
          details: { entity_id: params.entity_id, new_state: "off" },
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          details: { error: (error as Error).message },
        };
      }
    },

    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("ha_turn_off"))} ${theme.fg("error", args.entity_id)}`,
        0,
        0,
      );
    },
  });

  // Tool: Call unknown service
  pi.registerTool({
    name: "ha_call_service",
    label: "HA Call Service",
    description:
      "Call unknown Home Assistant service. Use for advanced operations not covered by other tools.",
    parameters: Type.Object({
      domain: Type.String({
        description: "Service domain (e.g., light, switch, script)",
      }),
      service: Type.String({
        description: "Service name (e.g., turn_on, toggle, reload)",
      }),
      data: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description: "Service data (entity_id, and unknown other parameters)",
        }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      try {
        const result = await haFetch<HAServiceResponse[]>(
          `/services/${params.domain}/${params.service}`,
          {
            method: "POST",
            body: params.data || {},
          },
        );

        return {
          content: [
            {
              type: "text",
              text: `Called ${params.domain}.${params.service}${params.data ? ` with ${JSON.stringify(params.data)}` : ""}`,
            },
          ],
          details: {
            domain: params.domain,
            service: params.service,
            response: result,
          },
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error: ${(error as Error).message}` },
          ],
          details: { error: (error as Error).message },
        };
      }
    },

    renderCall(args, theme) {
      let text = `${theme.fg("toolTitle", theme.bold("ha_call_service"))} ${theme.fg("accent", `${args.domain}.${args.service}`)}`;
      if (args.data) text += ` ${theme.fg("dim", JSON.stringify(args.data))}`;
      return new Text(text, 0, 0);
    },
  });

  // Command: Interactive entity browser
  pi.registerCommand("ha", {
    description: "Interactive Home Assistant entity browser",
    handler: async (args, ctx) => {
      const config = getConfig();
      if (!config) {
        ctx.ui.notify(
          "Home Assistant not configured. Run /home-assistant to set up.",
          "error",
        );
        return;
      }

      try {
        // Fetch all states
        const states = await haFetch<HAState[]>("/states");

        // Filter to toggleable domains if no args, otherwise filter by args
        const toggleableDomains = [
          "light",
          "switch",
          "fan",
          "cover",
          "input_boolean",
          "automation",
          "script",
        ];
        let filtered = states;

        if (args) {
          // Filter by args (domain or pattern)
          const query = args.toLowerCase();
          filtered = states.filter(
            (e) =>
              e.entity_id.toLowerCase().includes(query) ||
              (e.attributes.friendly_name as string | undefined)
                ?.toLowerCase()
                .includes(query),
          );
        } else {
          // Only show toggleable entities
          filtered = states.filter((e) =>
            toggleableDomains.includes(e.entity_id.split(".")[0]),
          );
        }

        // Sort by domain, then name
        filtered.sort((a, b) => a.entity_id.localeCompare(b.entity_id));

        if (filtered.length === 0) {
          ctx.ui.notify("No entities found", "warning");
          return;
        }

        // Build selection options
        const options = filtered.map((e) => {
          const name = (e.attributes.friendly_name as string) || e.entity_id;
          const stateIcon =
            e.state === "on" ? "●" : e.state === "off" ? "○" : "◌";
          return `${stateIcon} ${name} (${e.entity_id}) - ${e.state}`;
        });

        const selected = await ctx.ui.select(
          "Home Assistant Entities",
          options,
        );
        if (selected === undefined) return;

        const entity = filtered[Number(selected)];

        // Offer actions
        const actions = [
          "Toggle",
          "Turn On",
          "Turn Off",
          "Get Details",
          "Cancel",
        ];
        const action = await ctx.ui.select(
          `Action for ${entity.entity_id}`,
          actions,
        );
        if (action === undefined || action === "Cancel") return;

        const domain = entity.entity_id.split(".")[0];

        if (action === "Toggle") {
          // Toggle
          await haFetch(`/services/${domain}/toggle`, {
            method: "POST",
            body: { entity_id: entity.entity_id },
          });
          const newState = await haFetch<HAState>(
            `/states/${entity.entity_id}`,
          );
          ctx.ui.notify(`${entity.entity_id} → ${newState.state}`, "info");
        } else if (action === "Turn On") {
          // Turn On
          await haFetch(`/services/${domain}/turn_on`, {
            method: "POST",
            body: { entity_id: entity.entity_id },
          });
          ctx.ui.notify(`${entity.entity_id} turned on`, "info");
        } else if (action === "Turn Off") {
          // Turn Off
          await haFetch(`/services/${domain}/turn_off`, {
            method: "POST",
            body: { entity_id: entity.entity_id },
          });
          ctx.ui.notify(`${entity.entity_id} turned off`, "info");
        } else if (action === "Get Details") {
          // Get Details - show in editor for LLM context
          const state = await haFetch<HAState>(`/states/${entity.entity_id}`);
          const details = [
            `Entity: ${state.entity_id}`,
            `State: ${state.state}`,
            `Last changed: ${state.last_changed}`,
            `Attributes:`,
            ...Object.entries(state.attributes).map(
              ([k, v]) => `  ${k}: ${JSON.stringify(v)}`,
            ),
          ].join("\n");
          ctx.ui.setEditorText(details);
        }
      } catch (error) {
        ctx.ui.notify(`Error: ${(error as Error).message}`, "error");
      }
    },
  });
}

// Export constants and functions for testing
export { AUTH_FILE };
export { formatState };
export { getConfig };
export { saveConfig };
export { deleteConfig };
