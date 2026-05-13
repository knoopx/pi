import chalk from "chalk";
import { expect, vi } from "vitest";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import type { Change } from "../types";
import { createMockExtensionAPI } from "../../../shared/testing/test-utils";
import {
  createMockTheme as createMockThemeBase,
  TestTerminal,
} from "../../../shared/testing/mock-theme";

interface ChalkStyler {
  bold(t: string): string;
  italic(t: string): string;
  underline(t: string): string;
  inverse(t: string): string;
  strikethrough(t: string): string;
}

const c = (chalk.constructor as unknown as (...args: unknown[]) => ChalkStyler)(
  {
    level: 3,
  },
);

// Wrap the shared mock theme to use chalk for styling methods,
// matching the IDE extension's rendering behavior.
export function createMockTheme(): Theme {
  const base = createMockThemeBase();
  return {
    ...base,
    bold: (t: string) => c.bold(t),
    italic: (t: string) => c.italic(t),
    underline: (t: string) => c.underline(t),
    inverse: (t: string) => c.inverse(t),
    strikethrough: (t: string) => c.strikethrough(t),
  } as Theme;
}

export { TestTerminal };
export function createMockChange(overrides?: Partial<Change>): Change {
  return {
    changeId: "a",
    commitId: "",
    description: "x",
    author: "",
    timestamp: "",
    empty: false,
    immutable: false,
    parentIds: [],
    ...overrides,
  };
}

export function createMockPi(overrides?: Partial<ExtensionAPI>): ExtensionAPI {
  return {
    ...createMockExtensionAPI(),
    getFlag: vi.fn().mockReturnValue(null),
    exec: vi.fn().mockResolvedValue({
      code: 0,
      stdout: "",
      stderr: "",
    }),
    ...overrides,
  } as unknown as ExtensionAPI;
}
export function createMockTui() {
  const terminal = new TestTerminal(120, 30);
  return {
    terminal,
    requestRender: vi.fn(),
    setFocus: vi.fn(),
  } as unknown as TUI;
}

export function createComponentFixture<T extends Record<string, unknown>>(
  factory: (options: T) => { render: (cols: number) => string[] },
  options: Partial<T> & {
    pi?: ExtensionAPI;
    tui?: ReturnType<typeof createMockTui>;
    theme?: ReturnType<typeof createMockTheme>;
  },
): {
  component: ReturnType<typeof factory>;
  mockPi: ExtensionAPI;
  tui: ReturnType<typeof createMockTui>;
} {
  const mockPi = options.pi ?? createMockPi();
  const tui = options.tui ?? createMockTui();
  const theme = options.theme ?? createMockTheme();
  const component = factory({
    ...options,
    pi: mockPi,
    tui,
    theme,
  } as unknown as T) as ReturnType<typeof factory>;
  return { component, mockPi, tui };
}

export async function createComponentTest<T extends Record<string, unknown>>(
  factory: (options: T) => { render: (cols: number) => string[] },
  options: Omit<Partial<T>, "pi" | "tui"> & {
    stdout?: string;
    execRouter?: (
      cmd: string,
      args?: string[],
    ) => Promise<{ code: number; stdout: string; stderr: string }>;
  },
): Promise<{
  component: ReturnType<typeof factory>;
  tui: ReturnType<typeof createMockTui>;
}> {
  const mockPi = createMockPi({
    exec: options.execRouter
      ? vi.fn().mockImplementation(options.execRouter)
      : vi.fn().mockResolvedValue({
          code: 0,
          stdout: options.stdout ?? "",
          stderr: "",
        }),
  });
  const { component, tui } = createComponentFixture(factory, {
    ...options,
    pi: mockPi,
  } as Partial<T> & {
    pi?: ExtensionAPI;
    tui?: ReturnType<typeof createMockTui>;
    theme?: ReturnType<typeof createMockTheme>;
  });
  await new Promise((r) => setTimeout(r, 50));
  return { component, tui };
}

export function waitForAsyncHighlight(ms = 500): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function snapshotRender(component: {
  render: (cols: number) => string[];
}): void {
  const result = component.render(120);
  expect(result.join("\n")).toMatchSnapshot();
}

interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}
interface MockExecPi {
  pi: ExtensionAPI;
  execMock: ReturnType<
    typeof vi.fn<(...args: unknown[]) => Promise<ExecResult>>
  >;
}
export function createMockExecPi(): MockExecPi {
  const execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
  return {
    execMock,
    pi: { exec: execMock } as unknown as ExtensionAPI,
  };
}
export interface ErrorFixtureOptions<T extends Record<string, unknown>> {
  componentFactory: (options: T) => { render: (cols: number) => string[] };
  config: Partial<T> & {
    pi?: ExtensionAPI;
    tui?: ReturnType<typeof createMockTui>;
    theme?: ReturnType<typeof createMockTheme>;
  };
  stderr?: string;
}

export async function createErrorFixture<T extends Record<string, unknown>>(
  options: ErrorFixtureOptions<T>,
): Promise<string[]> {
  const { componentFactory, config, stderr = "command failed" } = options;
  const mockPi = createMockPi({
    exec: vi.fn().mockResolvedValue({
      code: 1,
      stdout: "",
      stderr,
    }),
  });
  const { component } = createComponentFixture(componentFactory, {
    ...config,
    pi: mockPi,
  });
  await new Promise((r) => setTimeout(r, 50));
  return component.render(120);
}

interface ExecRoute {
  command: string;
  args: string[];
  result: ExecResult;
}
export function createMockExecPiWithRoutes(routes: ExecRoute[]): MockExecPi {
  const execMock = vi
    .fn<(...args: unknown[]) => Promise<ExecResult>>()
    .mockImplementation(
      (command: unknown, args: unknown): Promise<ExecResult> => {
        const cmd = String(command);
        const argList = (args as string[]) ?? [];

        for (const route of routes) {
          if (cmd !== route.command) continue;
          const match = route.args.every((a, i) => argList[i] === a);
          if (match) return Promise.resolve(route.result);
        }

        return Promise.resolve({
          code: 1,
          stdout: "",
          stderr: "unexpected call",
        });
      },
    );

  return {
    execMock,
    pi: { exec: execMock } as unknown as ExtensionAPI,
  };
}
