import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import { stat, glob as fsGlob } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";

const exec = promisify(execCb);

const GLOB_CHARS = new Set(["*", "?", "[", "]"]);

const PATH_RE =
  /(?:^|\s)(\/[^ \t\n\r"'`<>,;:!{}]+|[a-zA-Z0-9_.+*-]+\/[a-zA-Z0-9_.+*?/][^ \t\n\r"'`<>,;:!{}]*)/g;
const QUOTED_PATH_RE = /"((?:\/[^\"]+|[a-zA-Z0-9_.+*-]+\/[^"]+)*)"\s*/g;

export interface DirTreeResult {
  path: string;
  output: string;
}

export interface GlobResult {
  pattern: string;
  directories: string[];
  files: string[];
}

function hasGlobChar(text: string): boolean {
  for (const ch of text) {
    if (GLOB_CHARS.has(ch)) return true;
  }
  return false;
}

function extractPaths(text: string): string[] {
  const paths = [...text.matchAll(PATH_RE)].map((m) => m[1]);
  const quoted = [...text.matchAll(QUOTED_PATH_RE)].map((m) => m[1]);
  return [...new Set([...paths, ...quoted])].filter((p) => hasGlobChar(p));
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

export async function detectGlobs(
  text: string,
  cwd: string,
): Promise<GlobResult[]> {
  const seen = new Set<string>();
  const results: GlobResult[] = [];

  for (const raw of extractPaths(text)) {
    if (seen.has(raw)) continue;
    seen.add(raw);

    const pattern = isAbsolute(raw) ? raw : resolve(cwd, raw);
    const matched = await expandGlob(pattern);
    if (matched.directories.length === 0 && matched.files.length === 0)
      continue;

    results.push({ ...matched, pattern: raw });
  }

  return results;
}

async function expandGlob(pattern: string): Promise<GlobResult> {
  const directories = new Set<string>();
  const files = new Set<string>();

  try {
    for await (const match of fsGlob(pattern)) {
      if (await isDirectory(match)) {
        directories.add(match);
      } else {
        files.add(match);
      }
    }
  } catch {
    // Invalid pattern or no matches
  }

  return {
    pattern,
    directories: [...directories],
    files: [...files],
  };
}

export function extractFileFilter(pattern: string): string | null {
  // Split on ** to get the file-matching portion of the glob.
  // tree -P only matches filenames, so we take the basename after **.
  // e.g. "agent/extensions/**/*.ts" -> "*.ts"
  //       "src/**/test/*.spec.ts" -> "*.spec.ts"
  const parts = pattern.split("**");
  if (parts.length <= 1) return null;
  const afterStar = parts[parts.length - 1];
  const stripped = afterStar.startsWith("/") ? afterStar.slice(1) : afterStar;
  const basename = stripped.split("/").pop();
  return basename ?? null;
}

export async function runTree(
  dir: string,
  filter?: string | null,
): Promise<string | null> {
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) return null;
    const pattern = filter ? ` -P "${filter}"` : "";
    const { stdout } = await exec(`tree --gitignore${pattern} "${dir}"`, {
      timeout: 2_000,
    });
    // tree prints the directory path as its first line; strip it to avoid duplication with formatTreeBlocks
    return stdout.trim().split("\n").slice(1).join("\n");
  } catch {
    return null;
  }
}

export function formatTreeBlocks(results: DirTreeResult[]): string {
  if (results.length === 0) return "";
  return results.map((r) => `${r.path}:\n${r.output}`).join("\n\n");
}

export interface EnrichedGlobResult extends GlobResult {
  trees: DirTreeResult[];
}

export function formatGlobResult(results: EnrichedGlobResult[]): string {
  const blocks: string[] = [];

  for (const r of results) {
    const parts: string[] = [`Glob: ${r.pattern}`];

    if (r.trees.length > 0) {
      parts.push(formatTreeBlocks(r.trees));
    }

    if (r.files.length > 0) {
      parts.push(r.files.join("\n"));
    }

    blocks.push(parts.join("\n"));
  }

  return blocks.join("\n\n");
}
