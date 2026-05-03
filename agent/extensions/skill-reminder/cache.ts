import { homedir } from "node:os";
import { resolve, join } from "node:path";
import type { FileIndexEntry } from "../../shared/indexing/cache";
import {
  loadCache as _loadCache,
  saveCache as _saveCache,
} from "../../shared/indexing/cache";

const CACHE_FILE = join(
  resolve(homedir(), ".cache", "pi-skill-reminder"),
  "index.json",
);

export async function loadSkillReminderCache(): Promise<FileIndexEntry | null> {
  return _loadCache(CACHE_FILE);
}

export async function saveSkillReminderCache(
  entry: FileIndexEntry,
): Promise<void> {
  return _saveCache(entry, CACHE_FILE);
}
