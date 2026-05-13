import { vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import {
  createMockPi,
  createMockTui,
  createMockTheme,
} from "../../test/utils";
import { TS_FILES, FILENAME_CONTENTS, EXTENSION_CONTENTS } from "./fixtures";

export async function mockReadFileImplementation(
  path: string | URL,
  _opts: unknown,
): Promise<string> {
  const p = typeof path === "string" ? path : path.toString();
  for (const [key, content] of Object.entries(TS_FILES)) {
    if (p.includes(key)) return content;
  }
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const base = p.split("/").pop() ?? "";
  const byName = FILENAME_CONTENTS[base];
  if (byName) return byName;
  const byExt = EXTENSION_CONTENTS[ext];
  if (byExt) return byExt;

  throw new Error(
    `Filesystem mock: no fixture for path "${p}". Tests must not hit the real filesystem.`,
  );
}

const REPO = "/home/user/project";
const DEFAULT_FILES_OUTPUT =
  "agent/extensions/ide/components/files.ts\nagent/extensions/ide/components/list-picker.ts\nagent/extensions/websearch/tests/nix.test.ts\n";

export function makeFilesMockPi(
  stdout = DEFAULT_FILES_OUTPUT,
  overrides?: Partial<ExtensionAPI>,
): ExtensionAPI {
  return createMockPi({
    exec: vi.fn().mockResolvedValue({ code: 0, stdout, stderr: "" }),
    ...overrides,
  });
}

export async function createFilesFixture(
  mockPi: ExtensionAPI,
  searchQuery = "",
) {
  const tui = createMockTui();
  const theme = createMockTheme();
  const ctx = { cwd: REPO } as ExtensionContext;
  const { createFilesComponent } = await import("./component");
  const component = createFilesComponent({
    pi: mockPi,
    tui,
    theme,
    keybindings: {} as unknown as KeybindingsManager,
    done: () => {},
    initialQuery: searchQuery,
    ctx,
  });

  await new Promise((r) => setTimeout(r, 50));
  return { component, tui };
}
