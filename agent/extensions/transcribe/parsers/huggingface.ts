import {
  createRetryFetch,
  createRetryFetchText,
  defineParser,
} from "../lib/parser-utils";
interface HFRepo {
  kind: "model" | "dataset" | "space";
  owner: string;
  name: string;
}
type HFPathType = "repo" | "file" | "tree" | "discussions" | "discussion";
interface HFPath extends HFRepo {
  type: HFPathType;
  revision?: string;
  path?: string;
  number?: number;
}
const BASE = "https://huggingface.co";
const API = `${BASE}/api`;
function parseHFUrl(url: string): HFPath | null {
  const match = url.match(/^https?:\/\/huggingface\.co\/(.+)$/);
  if (!match) return null;
  const rest = match[1].replace(/\/+$/, "");
  if (!rest) return null;
  const explicit = tryParseExplicitPath(rest);
  if (explicit) return explicit;

  return tryParseBarePath(rest);
}
function tryParseExplicitPath(rest: string): HFPath | null {
  const match = rest.match(
    /^(models|datasets|spaces)\/([^/]+)\/([^/]+)(?:\/(.+))?$/,
  );
  if (!match) return null;
  const [, kind, owner, name, subpath] = match;
  return parseSubpath(kind as HFRepo["kind"], owner, name, subpath ?? null);
}
function tryParseBarePath(rest: string): HFPath | null {
  const match = rest.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (!match) return null;
  const [, owner, name, subpath] = match;
  return parseSubpath("model", owner, name, subpath ?? null);
}
function parseSubpath(
  kind: HFRepo["kind"],
  owner: string,
  name: string,
  subpath: string | null,
): HFPath {
  const base: HFPath = { kind, owner, name, type: "repo" };
  if (!subpath) return base;
  const parts = subpath.split("/");
  const first = parts[0].toLowerCase();
  if (first === "blob") return tryParseBlobPath(base, parts);
  if (first === "tree") return parseTreePath(base, parts);
  if (first === "discussions") return parseDiscussionPath(base, parts);
  return base;
}
function tryParseBlobPath(base: HFPath, parts: string[]): HFPath {
  if (parts.length < 3) return base;
  return {
    ...base,
    type: "file",
    revision: parts[1],
    path: parts.slice(2).join("/"),
  };
}
function parseTreePath(base: HFPath, parts: string[]): HFPath {
  const revision = parts.length > 1 ? parts[1] : undefined;
  const filePath = parts.length > 2 ? parts.slice(2).join("/") : undefined;
  return { ...base, type: "tree", revision, path: filePath };
}
function parseDiscussionPath(base: HFPath, parts: string[]): HFPath {
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    return { ...base, type: "discussion", number: parseInt(parts[1], 10) };
  }
  return { ...base, type: "discussions" };
}

const hfFetchOpts = { apiName: "HuggingFace" };

function fetchJSON<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  return createRetryFetch(hfFetchOpts)(`${API}/${endpoint}`, signal);
}

function fetchRaw(
  repo: HFRepo,
  revision: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${BASE}/${repo.owner}/${repo.name}/resolve/${revision}/${filePath}`;
  return createRetryFetchText(hfFetchOpts)(url, signal);
}
interface HFTreeEntry {
  type: "file" | "directory";
  path: string;
  size?: number;
  lfs?: Record<string, unknown>;
}
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${i > 0 ? bytes.toFixed(1) : bytes} ${units[i]}`;
}
function tagToBullet(tag: string): string {
  const colon = tag.indexOf(":");
  if (colon > 0) return `${tag.slice(0, colon)}: ${tag.slice(colon + 1)}`;
  return tag;
}
function repoApiPath(parsed: HFPath): string {
  return `${parsed.kind}s/${parsed.owner}/${parsed.name}`;
}

async function fetchReadme(
  parsed: HFRepo,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const tree = await fetchJSON<HFTreeEntry[]>(
      `${repoApiPath(parsed as HFPath)}/tree/main`,
      signal,
    );
    const readmeEntry = tree.find((e) => e.path === "README.md");
    if (readmeEntry) {
      return await fetchRaw(parsed, "main", "README.md", signal);
    }
  } catch {
    // No README found or fetch failed; return empty string
  }
  return "";
}
interface MetaFields {
  downloads?: number;
  likes?: number;
  lastModified?: string;
  gated?: boolean | string;
}
function buildMeta(fields: MetaFields): string {
  const meta = [
    formatDownloads(fields),
    formatLikes(fields),
    formatDate(fields),
    formatGated(fields),
  ].filter(Boolean);
  return meta.join(" • ");
}
function formatDownloads(f: MetaFields): string | null {
  if (f.downloads === undefined) return null;
  return `downloads: ${f.downloads.toLocaleString()}`;
}
function formatLikes(f: MetaFields): string | null {
  if (f.likes === undefined) return null;
  return `likes: ${f.likes.toLocaleString()}`;
}
function formatDate(f: MetaFields): string | null {
  if (!f.lastModified) return null;
  return `updated: ${f.lastModified.split("T")[0]}`;
}
function formatGated(f: MetaFields): string | null {
  if (!f.gated) return null;
  return `gated: ${f.gated === true ? "yes" : f.gated}`;
}
function renderTags(
  parts: string[],
  tags: string[],
  filterFn?: (tag: string) => boolean,
  limit?: number,
): void {
  const filtered = filterFn ? tags.filter(filterFn) : tags;
  const sliced = limit ? filtered.slice(0, limit) : filtered;
  if (sliced.length) {
    parts.push("");
    parts.push("**Tags:**");
    for (const tag of sliced) {
      parts.push(`- ${tagToBullet(tag)}`);
    }
  }
}
function appendReadme(parts: string[], readme: string): void {
  if (readme) {
    parts.push("");
    parts.push(readme);
  }
}

interface RepoBodyOptions {
  tags?: string[];
  downloads?: number;
  likes?: number;
  lastModified?: string;
  gated?: boolean | string;
  tagFilter?: (tag: string) => boolean;
  tagLimit?: number;
  extraDescription?: string;
}

async function renderRepoBody(
  parts: string[],
  opts: RepoBodyOptions,
  parsed: HFPath,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (opts.tags?.length) {
    renderTags(parts, opts.tags, opts.tagFilter, opts.tagLimit);
  }
  const metaStr = buildMeta(opts);
  if (metaStr) {
    parts.push("");
    parts.push(metaStr);
  }
  const readme = await fetchReadme(parsed, signal);
  if (readme) {
    appendReadme(parts, readme);
  } else if (opts.extraDescription) {
    parts.push("");
    parts.push(opts.extraDescription);
  }
}
function addKindSpecificHeader(
  parts: string[],
  kind: HFRepo["kind"],
  info: Record<string, unknown>,
): void {
  if (kind === "model" && typeof info.pipeline_tag === "string") {
    parts.push(`**Pipeline:** ${info.pipeline_tag}`);
  } else if (kind === "space" && typeof info.sdk === "string") {
    parts.push(`**SDK:** ${info.sdk}`);
  }
}
function makeTagFilter(
  kind: HFRepo["kind"],
): ((t: string) => boolean) | undefined {
  if (kind === "model") {
    return (t) => !t.startsWith("region:") && t !== "safetensors";
  }
  if (kind === "dataset") {
    return (t) => !t.startsWith("region:");
  }
  return undefined;
}
function extractDatasetDescription(
  info: Record<string, unknown>,
): string | undefined {
  const raw = info.description;
  if (typeof raw !== "string" || !raw) return undefined;
  return raw.replace(/\t+/g, "").replace(/>\s*/g, ">").trim();
}

function extractRepoTags(info: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(info.tags)) return undefined;
  return info.tags.filter((t): t is string => typeof t === "string");
}

function safeNumber(val: unknown, fallback?: number): number | undefined {
  return typeof val === "number" ? val : fallback;
}

function safeString(val: unknown, fallback?: string): string | undefined {
  return typeof val === "string" ? val : fallback;
}

function buildRepoBodyOptions(
  info: Record<string, unknown>,
  parsed: HFPath,
): RepoBodyOptions {
  const datasetDesc =
    parsed.kind === "dataset" ? extractDatasetDescription(info) : undefined;
  return {
    tags: extractRepoTags(info),
    downloads: safeNumber(info.downloads),
    likes: safeNumber(info.likes),
    lastModified: safeString(info.lastModified),
    gated:
      typeof info.gated === "boolean" || typeof info.gated === "string"
        ? info.gated
        : undefined,
    tagFilter: makeTagFilter(parsed.kind),
    tagLimit: parsed.kind === "dataset" ? 20 : undefined,
    extraDescription: datasetDesc,
  };
}

async function handleRepo(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const info = await fetchJSON<Record<string, unknown>>(
    repoApiPath(parsed),
    signal,
  );
  const title = safeString(info.id, "unknown")!;
  const parts: string[] = [`# ${title}`];
  addKindSpecificHeader(parts, parsed.kind, info);

  await renderRepoBody(
    parts,
    buildRepoBodyOptions(info, parsed),
    parsed,
    signal,
  );
  return parts.join("\n");
}
async function handleFile(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  if (!parsed.path) throw new Error("Missing file path");
  const revision = parsed.revision ?? "main";
  let content: string;

  try {
    content = await fetchRaw(parsed, revision, parsed.path, signal);
  } catch {
    const info = await fetchJSON<Record<string, unknown>>(
      repoApiPath(parsed),
      signal,
    );
    const sha = typeof info.sha === "string" ? info.sha : "main";
    content = await fetchRaw(parsed, sha, parsed.path, signal);
  }

  return `# ${parsed.path}\n\n\`${parsed.owner}/${parsed.name}@${revision}\`\n\n${content}`;
}

async function handleTree(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const revision = parsed.revision ?? "main";
  const tree = await fetchJSON<HFTreeEntry[]>(
    `${repoApiPath(parsed)}/tree/${revision}${parsed.path ? `/${parsed.path}` : ""}`,
    signal,
  );
  const heading = parsed.path
    ? `${parsed.owner}/${parsed.name} — ${parsed.path}`
    : `${parsed.owner}/${parsed.name}`;
  const parts: string[] = [`# ${heading}`, "", `\`revision: ${revision}\``];
  const dirs = tree.filter((e) => e.type === "directory");
  const files = tree.filter((e) => e.type === "file");

  if (dirs.length) {
    parts.push("", "## Directories", ...dirs.map((d) => `- \`${d.path}/\``));
  }

  if (files.length) {
    parts.push("", "## Files", ...renderFileList(files));
  }

  return parts.join("\n");
}
function renderFileList(files: HFTreeEntry[]): string[] {
  const lines: string[] = [];
  for (const f of files.slice(0, 100)) {
    const size = f.size ? ` (${formatBytes(f.size)})` : "";
    const lfs = f.lfs ? " [LFS]" : "";
    lines.push(`- \`${f.path}\`${size}${lfs}`);
  }
  if (files.length > 100) {
    lines.push(`- ... and ${files.length - 100} more files`);
  }
  return lines;
}
function handleDiscussion(
  parsed: HFPath,
  { showNote = false }: { showNote?: boolean } = {},
): string {
  const url = `${BASE}/${parsed.owner}/${parsed.name}/discussions${parsed.number ? `/${parsed.number}` : ""}`;
  const parts: string[] = [
    parsed.number ? `# Discussion #${parsed.number}` : `# Discussions`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
  ];

  if (parsed.kind !== "model") parts.push(`**Kind:** ${parsed.kind}`);
  parts.push("");
  parts.push(
    parsed.number
      ? `[View on HuggingFace](${url})`
      : `[View all discussions](${url})`,
  );

  if (showNote) {
    parts.push(
      "",
      `> Note: Individual discussion content is not available via the public API. The full discussion is available at the link above.`,
    );
  }

  return parts.join("\n");
}

async function dispatchHF(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  switch (parsed.type) {
    case "file":
      return handleFile(parsed, signal);
    case "tree":
      return handleTree(parsed, signal);
    case "discussion":
      return handleDiscussion(parsed, { showNote: true });
    case "discussions":
      return handleDiscussion(parsed);
    case "repo":
      return handleRepo(parsed, signal);
  }
}
export const huggingfaceParser = defineParser(
  "HuggingFace",
  (url) => /^https?:\/\/huggingface\.co\//i.test(url),
  parseHFUrl,
  dispatchHF,
);
