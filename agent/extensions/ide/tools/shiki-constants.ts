import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BundledTheme } from "shiki";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

const DEFAULT_THEME: BundledTheme = "github-dark";
const IDE_SETTINGS_KEY = "ide";

export let THEME: BundledTheme = DEFAULT_THEME;

const MAX_HL_CHARS =
  Number.parseInt(process.env.PRETTY_MAX_HL_CHARS ?? "", 10) || 80_000;
export const MAX_PREVIEW_LINES =
  Number.parseInt(process.env.PRETTY_MAX_PREVIEW_LINES ?? "", 10) || 80;
const CACHE_LIMIT =
  Number.parseInt(process.env.PRETTY_CACHE_LIMIT ?? "", 10) || 128;

async function loadIdeTheme(): Promise<void> {
  const settingsPath = join(getAgentDir(), "settings.json");
  const content = await readFile(settingsPath, "utf-8");
  const settings = JSON.parse(content) as Record<string, unknown>;
  const ide = settings[IDE_SETTINGS_KEY] as Record<string, unknown> | undefined;
  const theme = ide?.theme as string | undefined;
  if (typeof theme === "string" && theme !== "") {
    THEME = theme as BundledTheme;
  }
}

void loadIdeTheme().catch(() => {});

export { MAX_HL_CHARS, CACHE_LIMIT };
