import type { Theme } from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";

const fsPromises = await vi.importMock("node:fs/promises");

export const mockReaddir = (fsPromises as { readdir: ReturnType<typeof vi.fn> })
  .readdir;
export const mockReadFile = (
  fsPromises as { readFile: ReturnType<typeof vi.fn> }
).readFile;

export function createMockTheme(): Theme {
  return {
    fg(_color: string, text: string) {
      return text;
    },
    bold(text: string) {
      return text;
    },
  } as Theme;
}
