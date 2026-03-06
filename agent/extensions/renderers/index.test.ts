/**
 * Tests for renderers extension.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import renderDataExtension from "./index";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const { spawnSync } = await import("node:child_process");

function createMockPi() {
  const tools = new Map<string, any>();
  const mock = {
    registerTool: vi.fn((tool: any) => tools.set(tool.name, tool)),
    tool: (name = "render-data") => tools.get(name),
  };
  return mock;
}

function mockNuSuccess(stdout: string) {
  vi.mocked(spawnSync).mockReturnValue({
    stdout,
    stderr: "",
    status: 0,
    error: undefined,
  } as any);
}

async function executeTool(pi: ReturnType<typeof createMockPi>, data: unknown) {
  return pi.tool().execute("id", { data }, undefined, () => {}, {});
}

describe("renderDataExtension", () => {
  let pi: ReturnType<typeof createMockPi>;

  beforeEach(() => {
    vi.clearAllMocks();
    pi = createMockPi();
    renderDataExtension(pi as unknown as ExtensionAPI);
  });

  describe("given extension registration", () => {
    it("then registers only render-data tool", () => {
      expect(pi.registerTool).toHaveBeenCalledTimes(1);
      const tool = pi.tool();
      expect(tool.name).toBe("render-data");
      expect(tool.label).toBe("Render Data");
      expect(tool.description).toContain("structured data");
    });
  });

  describe("given tool execution", () => {
    describe("when nu returns output", () => {
      beforeEach(() => {
        mockNuSuccess("{name: test}");
      });

      it("then passes JSON via NU_DATA env var", async () => {
        await executeTool(pi, { name: "test" });

        const [cmd, args, opts] = vi.mocked(spawnSync).mock.calls[0];
        expect(cmd).toBe("nu");
        expect(args).toEqual(["-c", "$env.NU_DATA | from json | table -e"]);
        expect(opts!.env).toMatchObject({ NU_DATA: '{"name":"test"}' });
      });

      it("then returns content with text type", async () => {
        const result = await executeTool(pi, { name: "test" });

        expect(result.content).toHaveLength(1);
        expect(result.content[0]).toEqual({
          type: "text",
          text: "{name: test}",
        });
      });

      it("then returns empty details", async () => {
        const result = await executeTool(pi, { name: "test" });
        expect(result.details).toEqual({});
      });
    });

    describe("when data is already a JSON string", () => {
      beforeEach(() => {
        mockNuSuccess("{a: 1}");
      });

      it("then passes string directly without double-encoding", async () => {
        await executeTool(pi, '{"a":1}');

        const opts = vi.mocked(spawnSync).mock.calls[0][2];
        expect(opts!.env!.NU_DATA).toBe('{"a":1}');
      });
    });

    const inputCases = [
      { scenario: "object", data: { a: 1 }, json: '{"a":1}' },
      { scenario: "nested", data: { a: { b: 2 } }, json: '{"a":{"b":2}}' },
      { scenario: "array", data: [1, 2, 3], json: "[1,2,3]" },
      { scenario: "null", data: null, json: "null" },
      { scenario: "number", data: 42, json: "42" },
      { scenario: "boolean", data: true, json: "true" },
      { scenario: "empty object", data: {}, json: "{}" },
      { scenario: "empty array", data: [], json: "[]" },
    ];

    inputCases.forEach(({ scenario, data, json }) => {
      describe(`when data is ${scenario}`, () => {
        beforeEach(() => {
          mockNuSuccess("ok");
        });

        it("then passes correct JSON via env var", async () => {
          await executeTool(pi, data);

          const opts = vi.mocked(spawnSync).mock.calls[0][2];
          expect(opts!.env!.NU_DATA).toBe(json);
        });
      });
    });
  });

  describe("given execution errors", () => {
    describe("when nu command fails", () => {
      beforeEach(() => {
        vi.mocked(spawnSync).mockReturnValue({
          stdout: "",
          stderr: "nu parse error",
          status: 1,
          error: undefined,
        } as any);
      });

      it("then throws with stderr message", async () => {
        await expect(executeTool(pi, { x: 1 })).rejects.toThrow(
          "nu parse error",
        );
      });
    });

    describe("when spawn fails", () => {
      beforeEach(() => {
        vi.mocked(spawnSync).mockReturnValue({
          stdout: "",
          stderr: "",
          status: null,
          error: new Error("ENOENT"),
        } as any);
      });

      it("then throws the spawn error", async () => {
        await expect(executeTool(pi, {})).rejects.toThrow("ENOENT");
      });
    });
  });
});
