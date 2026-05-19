import { fetchJSON, fetchRaw, repoApiPath, BASE } from "./http";
import type { HFPath, HFTreeEntry, HFDiscussionDetail } from "./types";
import { renderRepo } from "./rendering/repo";
import { renderModelDetails } from "./rendering/model";
import {
  renderDiscussionDetail,
  renderDiscussionsList,
  buildDiscussionFallback,
} from "./rendering/discussions";

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${i > 0 ? bytes.toFixed(1) : bytes} ${units[i]}`;
}

function renderFileList(files: HFTreeEntry[]): string[] {
  const lines: string[] = [];
  for (const f of files) {
    const size = f.size ? ` (${formatBytes(f.size)})` : "";
    const lfs = f.lfs ? " [LFS]" : "";
    lines.push(`- \`${f.path}\`${size}${lfs}`);
  }
  return lines;
}

export async function handleRepo(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const info = await fetchJSON<Record<string, unknown>>(
    repoApiPath(parsed),
    signal,
  );

  let result = await renderRepo(parsed, info, signal);

  if (parsed.kind === "model") {
    const parts = result.split("\n");
    await renderModelDetails(parts, parsed, info, signal);
    result = parts.join("\n");
  }

  return result;
}

export async function handleFile(
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

export async function handleTree(
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

export async function handleDiscussion(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const baseUrl = `${BASE}/${parsed.owner}/${parsed.name}/discussions`;
  const url = parsed.number ? `${baseUrl}/${parsed.number}` : baseUrl;

  if (parsed.number) {
    try {
      const detail = await fetchJSON(
        `models/${parsed.owner}/${parsed.name}/discussions/${parsed.number}`,
        signal,
      );
      return renderDiscussionDetail(parsed, detail as HFDiscussionDetail);
    } catch {
      // Graceful degradation: single discussion fetch failed, fall through to list
    }
  }

  try {
    const result: {
      discussions: Array<{
        num: number;
        title: string;
        status: string;
        isPullRequest: boolean;
        pinned: boolean;
        createdAt: string;
        numComments: number;
        author: { name: string };
      }>;
    } = await fetchJSON(
      `models/${parsed.owner}/${parsed.name}/discussions?limit=50`,
      signal,
    );
    return renderDiscussionsList(parsed, result.discussions);
  } catch {
    // Graceful degradation: discussions list fetch failed
  }

  return buildDiscussionFallback(parsed, url);
}
