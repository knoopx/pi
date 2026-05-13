import type { HFPath, HFRepo } from "./types";

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

export { parseHFUrl };
