import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
  type Mock,
} from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

let guardrailsExtension: (pi: ExtensionAPI) => Promise<void>;
let isGroupActive: (
  pattern: string,
  root: string,
  excludePattern?: string,
) => Promise<boolean>;
let configLoader: {
  load: Mock;
  getConfig: Mock;
};
let loadGuardrailsSettings: Mock;
let saveGuardrailsSettings: Mock;
let glob: Mock;

beforeAll(async () => {
  vi.doMock("./config", () => ({
    configLoader: {
      load: vi.fn(),
      getConfig: vi.fn(),
    },
    loadGuardrailsSettings: vi.fn().mockResolvedValue({ enabled: true }),
    saveGuardrailsSettings: vi.fn().mockResolvedValue({ enabled: true }),
  }));

  const globMock = vi.fn();
  glob = globMock as unknown as Mock;
  vi.doMock("tinyglobby", () => ({ glob: globMock }));

  const mod = await import("./index");
  guardrailsExtension = mod.default;
  isGroupActive = mod.isGroupActive;

  const configModule = await import("./config");
  configLoader = configModule.configLoader as unknown as typeof configLoader;
  loadGuardrailsSettings =
    configModule.loadGuardrailsSettings as unknown as Mock;
  saveGuardrailsSettings =
    configModule.saveGuardrailsSettings as unknown as Mock;
});

afterAll(() => {
  vi.doUnmock("./config");
  vi.doUnmock("tinyglobby");
  vi.resetModules();
});

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    cwd: "/test/project",
    hasUI: true,
    ui: {
      notify: vi.fn(),
      confirm: vi.fn().mockResolvedValue(true),
    },
    ...overrides,
  };
}

async function setupHandler(
  config: unknown[],
  options: { primeTree?: boolean } = {},
) {
  configLoader.load.mockReturnValue(undefined);
  configLoader.getConfig.mockReturnValue(config);
  glob.mockResolvedValue(["package.json"]);

  const pi = { on: vi.fn(), registerCommand: vi.fn() };
  await guardrailsExtension(pi as unknown as ExtensionAPI);
  const handler = pi.on.mock.calls.find((c) => c[0] === "tool_call")?.[1] as (
    event: unknown,
    ctx: unknown,
  ) => Promise<unknown>;

  if (options.primeTree ?? true)
    await handler(
      { toolName: "bash", input: { command: "tree ." } },
      makeCtx(),
    );

  return handler;
}

describe("isGroupActive", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("given wildcard pattern", () => {
    it("then returns true", async () => {
      expect(await isGroupActive("*", "/test")).toBe(true);
    });
  });

  describe("given matching pattern", () => {
    it("then returns true", async () => {
      glob.mockResolvedValue(["tsconfig.json"]);
      expect(await isGroupActive("*.json", "/test")).toBe(true);
    });
  });

  describe("given no matches", () => {
    it("then returns false", async () => {
      glob.mockResolvedValue([]);
      expect(await isGroupActive("*.lock", "/test")).toBe(false);
    });
  });

  describe("given glob failure", () => {
    it("then returns false", async () => {
      glob.mockRejectedValue(new Error("boom"));
      expect(await isGroupActive("*.ts", "/test")).toBe(false);
    });
  });

  describe("given excludePattern", () => {
    it("then deactivates group when exclude matches", async () => {
      glob.mockImplementation((pattern: string) => {
        if (pattern === "flake.nix") return ["flake.nix"];
        if (pattern === ".jj") return [".jj"];
        return [];
      });
      expect(await isGroupActive("flake.nix", "/test", ".jj")).toBe(false);
    });

    it("then keeps group active when exclude does not match", async () => {
      glob.mockImplementation((pattern: string) => {
        if (pattern === "flake.nix") return ["flake.nix"];
        if (pattern === ".jj") return [];
        return [];
      });
      expect(await isGroupActive("flake.nix", "/test", ".jj")).toBe(true);
    });

    it("then deactivates wildcard group when exclude matches", async () => {
      glob.mockImplementation((pattern: string) => {
        if (pattern === ".jj") return [".jj"];
        return [];
      });
      expect(await isGroupActive("*", "/test", ".jj")).toBe(false);
    });

    it("then keeps wildcard group active when exclude does not match", async () => {
      glob.mockImplementation((pattern: string) => {
        if (pattern === ".jj") return [];
        return [];
      });
      expect(await isGroupActive("*", "/test", ".jj")).toBe(true);
    });
  });
});

// eslint-disable-next-line max-lines-per-function -- large test suite
describe("guardrails extension", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("given extension startup", () => {
    it("then loads config and registers tool_call hook", async () => {
      configLoader.load.mockReturnValue(undefined);
      configLoader.getConfig.mockReturnValue([]);

      const pi = { on: vi.fn(), registerCommand: vi.fn() };
      await guardrailsExtension(pi as unknown as ExtensionAPI);

      expect(configLoader.load).toHaveBeenCalled();
      expect(configLoader.getConfig).toHaveBeenCalled();
      expect(loadGuardrailsSettings).toHaveBeenCalled();
      expect(pi.on).toHaveBeenCalledWith("tool_call", expect.any(Function));
    });
  });

  describe("given /guardrails command", () => {
    it("then persists on/off state", async () => {
      configLoader.load.mockReturnValue(undefined);
      configLoader.getConfig.mockReturnValue([]);
      glob.mockResolvedValue(["package.json"]);

      const pi = { on: vi.fn(), registerCommand: vi.fn() };
      await guardrailsExtension(pi as unknown as ExtensionAPI);

      const command = pi.registerCommand.mock.calls.find(
        (c) => c[0] === "guardrails",
      )?.[1] as {
        handler: (
          args: string,
          ctx: ReturnType<typeof makeCtx>,
        ) => Promise<void>;
      };

      const ctx = makeCtx();
      await command.handler("off", ctx);
      await command.handler("on", ctx);

      expect(saveGuardrailsSettings).toHaveBeenCalledWith({ enabled: false });
      expect(saveGuardrailsSettings).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe("given command context AST-like pattern", () => {
    it("then blocks matching command", async () => {
      const handler = await setupHandler([
        {
          group: "bun",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "npm *",
              action: "block",
              reason: "use bun",
            },
          ],
        },
      ]);

      const result = await handler(
        { toolName: "bash", input: { command: "npm install" } },
        makeCtx(),
      );

      expect(result).toEqual({ block: true, reason: "Blocked [bun]: use bun" });
    });

    it("then allows non-matching command", async () => {
      const handler = await setupHandler([
        {
          group: "bun",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "npm *",
              action: "block",
              reason: "use bun",
            },
          ],
        },
      ]);

      const result = await handler(
        { toolName: "bash", input: { command: "bun install" } },
        makeCtx(),
      );

      expect(result).toBeUndefined();
    });

    it("then matches command after env and &&", async () => {
      const handler = await setupHandler([
        {
          group: "bun",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "npm *",
              action: "block",
              reason: "use bun",
            },
          ],
        },
      ]);

      const result = await handler(
        {
          toolName: "bash",
          input: { command: "NODE_ENV=prod cd /tmp && env npm install" },
        },
        makeCtx(),
      );

      expect(result).toEqual({ block: true, reason: "Blocked [bun]: use bun" });
    });
  });

  describe("given command includes/excludes patterns", () => {
    it("then enforces includes with AST-like matcher", async () => {
      const handler = await setupHandler([
        {
          group: "danger",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "find *",
              includes: "find * --delete *",
              action: "block",
              reason: "dangerous find",
            },
          ],
        },
      ]);

      const blocked = await handler(
        { toolName: "bash", input: { command: "find . --delete" } },
        makeCtx(),
      );
      const allowed = await handler(
        { toolName: "bash", input: { command: "find . -name '*.ts'" } },
        makeCtx(),
      );

      expect(blocked).toEqual({
        block: true,
        reason: "Blocked [danger]: dangerous find",
      });
      expect(allowed).toBeUndefined();
    });

    it("then enforces excludes with AST-like matcher", async () => {
      const handler = await setupHandler([
        {
          group: "jj",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "jj squash *",
              excludes: "jj squash * -m *",
              action: "block",
              reason: "add -m",
            },
          ],
        },
      ]);

      const blocked = await handler(
        { toolName: "bash", input: { command: "jj squash" } },
        makeCtx(),
      );
      const allowed = await handler(
        { toolName: "bash", input: { command: "jj squash -m 'msg'" } },
        makeCtx(),
      );

      expect(blocked).toEqual({ block: true, reason: "Blocked [jj]: add -m" });
      expect(allowed).toBeUndefined();
    });
  });

  describe("given confirm action", () => {
    it("then prompts and allows when user confirms", async () => {
      const handler = await setupHandler([
        {
          group: "danger",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "rm -rf *",
              action: "confirm",
              reason: "dangerous",
            },
          ],
        },
      ]);

      const c = makeCtx();
      const result = await handler(
        { toolName: "bash", input: { command: "rm -rf /tmp" } },
        c,
      );

      expect((c.ui as { confirm: Mock }).confirm).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("then blocks when user denies", async () => {
      const handler = await setupHandler([
        {
          group: "danger",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "rm -rf *",
              action: "confirm",
              reason: "dangerous",
            },
          ],
        },
      ]);

      const c = makeCtx();
      (c.ui as { confirm: Mock }).confirm.mockResolvedValue(false);
      const result = await handler(
        { toolName: "bash", input: { command: "rm -rf /tmp" } },
        c,
      );

      expect(result).toEqual({
        block: true,
        reason: "Blocked: User denied execution",
      });
    });
  });

  describe("given file_name and file_content contexts", () => {
    it("then matches file_name rules on edit/write", async () => {
      const handler = await setupHandler([
        {
          group: "lock",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "package-lock.json",
              action: "block",
              reason: "no lock edits",
            },
          ],
        },
      ]);

      const result = await handler(
        {
          toolName: "edit",
          input: { path: "package-lock.json", oldText: "", newText: "" },
        },
        makeCtx(),
      );
      expect(result).toEqual({
        block: true,
        reason: "Blocked [lock]: no lock edits",
      });
    });

    it("then matches file_content rules on write", async () => {
      const handler = await setupHandler([
        {
          group: "ts",
          pattern: "*",
          rules: [
            {
              context: "file_content",
              pattern: "@ts-ignore",
              action: "block",
              reason: "no ts-ignore",
            },
          ],
        },
      ]);

      const result = await handler(
        {
          toolName: "write",
          input: { path: "src/a.ts", content: "// @ts-ignore" },
        },
        makeCtx(),
      );
      expect(result).toEqual({
        block: true,
        reason: "Blocked [ts]: no ts-ignore",
      });
    });

    it("then applies file_pattern filter to file_content rules", async () => {
      const handler = await setupHandler([
        {
          group: "linting",
          pattern: "*",
          rules: [
            {
              context: "file_content",
              file_pattern: "*.{js,ts}",
              pattern: "eslint-disable",
              action: "block",
              reason: "no eslint-disable",
            },
          ],
        },
      ]);

      // Should block for .ts files
      const tsResult = await handler(
        {
          toolName: "write",
          input: { path: "src/a.ts", content: "// eslint-disable-next-line" },
        },
        makeCtx(),
      );
      expect(tsResult).toEqual({
        block: true,
        reason: "Blocked [linting]: no eslint-disable",
      });

      // Should allow for .md files
      const mdResult = await handler(
        {
          toolName: "write",
          input: { path: "README.md", content: "Use eslint-disable sparingly" },
        },
        makeCtx(),
      );
      expect(mdResult).toBeUndefined();
    });

    it("then applies file_pattern filter to file_name rules", async () => {
      const handler = await setupHandler([
        {
          group: "js-only",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              file_pattern: "*.js",
              pattern: "**/src/**",
              action: "block",
              reason: "no js in src",
            },
          ],
        },
      ]);

      // Should block .js in src/
      const jsResult = await handler(
        {
          toolName: "write",
          input: { path: "src/a.js", content: "" },
        },
        makeCtx(),
      );
      expect(jsResult).toEqual({
        block: true,
        reason: "Blocked [js-only]: no js in src",
      });

      // Should allow .ts in src/
      const tsResult = await handler(
        {
          toolName: "write",
          input: { path: "src/a.ts", content: "" },
        },
        makeCtx(),
      );
      expect(tsResult).toBeUndefined();
    });
  });

  describe("given group with excludePattern", () => {
    it("then skips group when exclude matches", async () => {
      const handler = await setupHandler([
        {
          group: "nix",
          pattern: "flake.nix",
          excludePattern: ".jj",
          rules: [
            {
              context: "command",
              pattern: "nix ? . *",
              action: "block",
              reason: "use path:.",
            },
          ],
        },
      ]);

      glob.mockImplementation((pattern: string) => {
        if (pattern === "flake.nix") return ["flake.nix"];
        if (pattern === ".jj") return [".jj"];
        return [];
      });

      const result = await handler(
        { toolName: "bash", input: { command: "nix build ." } },
        makeCtx(),
      );
      expect(result).toBeUndefined();
    });
  });

  describe("given read tool", () => {
    it("then bypasses guardrails", async () => {
      const handler = await setupHandler([
        {
          group: "all",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "*",
              action: "block",
              reason: "block all",
            },
          ],
        },
      ]);

      const result = await handler(
        { toolName: "read", input: { path: "any" } },
        makeCtx(),
      );
      expect(result).toBeUndefined();
    });
  });

  describe("given scope option", () => {
    it("then applies project scope to project files only", async () => {
      const handler = await setupHandler([
        {
          group: "project-only",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "*secret*",
              scope: "project",
              action: "block",
              reason: "project files only",
            },
          ],
        },
      ]);

      const ctx = makeCtx({ cwd: "/test/project" });

      // Should block project file
      const projectResult = await handler(
        {
          toolName: "edit",
          input: { path: "src/secret.ts", oldText: "", newText: "" },
        },
        ctx,
      );
      expect(projectResult).toEqual({
        block: true,
        reason: "Blocked [project-only]: project files only",
      });

      // Should allow external file
      const externalResult = await handler(
        {
          toolName: "edit",
          input: { path: "/home/user/secret.ts", oldText: "", newText: "" },
        },
        ctx,
      );
      expect(externalResult).toBeUndefined();
    });

    it("then applies external scope to external files only", async () => {
      const handler = await setupHandler([
        {
          group: "external-only",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "*config*",
              scope: "external",
              action: "block",
              reason: "external files only",
            },
          ],
        },
      ]);

      const ctx = makeCtx({ cwd: "/test/project" });

      // Should allow project file
      const projectResult = await handler(
        {
          toolName: "edit",
          input: { path: "src/config.ts", oldText: "", newText: "" },
        },
        ctx,
      );
      expect(projectResult).toBeUndefined();

      // Should block external file
      const externalResult = await handler(
        {
          toolName: "edit",
          input: { path: "/etc/config.json", oldText: "", newText: "" },
        },
        ctx,
      );
      expect(externalResult).toEqual({
        block: true,
        reason: "Blocked [external-only]: external files only",
      });
    });

    it("then applies to all files when scope is not specified", async () => {
      const handler = await setupHandler([
        {
          group: "all-files",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "*dangerous*",
              action: "block",
              reason: "no scope specified",
            },
          ],
        },
      ]);

      const ctx = makeCtx({ cwd: "/test/project" });

      // Should block project file
      const projectResult = await handler(
        {
          toolName: "edit",
          input: { path: "src/dangerous.ts", oldText: "", newText: "" },
        },
        ctx,
      );
      expect(projectResult).toEqual({
        block: true,
        reason: "Blocked [all-files]: no scope specified",
      });

      // Should block external file
      const externalResult = await handler(
        {
          toolName: "edit",
          input: { path: "/tmp/dangerous.sh", oldText: "", newText: "" },
        },
        ctx,
      );
      expect(externalResult).toEqual({
        block: true,
        reason: "Blocked [all-files]: no scope specified",
      });
    });

    it("then handles absolute paths within project correctly", async () => {
      const handler = await setupHandler([
        {
          group: "project-scope",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "*test*",
              scope: "project",
              action: "block",
              reason: "project scope",
            },
          ],
        },
      ]);

      const ctx = makeCtx({ cwd: "/test/project" });

      // Should block absolute path within project
      const absoluteResult = await handler(
        {
          toolName: "edit",
          input: {
            path: "/test/project/src/test.ts",
            oldText: "",
            newText: "",
          },
        },
        ctx,
      );
      expect(absoluteResult).toEqual({
        block: true,
        reason: "Blocked [project-scope]: project scope",
      });
    });
  });
});
