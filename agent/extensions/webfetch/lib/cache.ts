import * as fs from "node:fs";
import * as crypto from "node:crypto";
import * as path from "node:path";
import * as os from "node:os";

const CACHE_DIR = path.join(os.homedir(), ".cache", "pi-webfetch");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  timestamp: number;
  content: string;
}

function cacheKey(source: string): string {
  return crypto.createHash("sha256").update(source).digest("hex");
}

function ensureCacheDir(): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function getCached(
  source: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<string | null> {
  const key = cacheKey(source);
  const filePath = path.join(CACHE_DIR, key);

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const entry: CacheEntry = JSON.parse(raw);

    if (Date.now() - entry.timestamp > ttlMs) {
      return null;
    }

    return entry.content;
  } catch {
    return null;
  }
}

export async function setCached(source: string, content: string): Promise<void> {
  const key = cacheKey(source);
  const filePath = path.join(CACHE_DIR, key);

  ensureCacheDir();

  const entry: CacheEntry = {
    timestamp: Date.now(),
    content,
  };

  fs.writeFileSync(filePath, JSON.stringify(entry), "utf8");
}
