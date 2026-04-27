import { spawn } from "node:child_process";
import type { Parser } from "../lib/types";

interface GitHubPath {
  owner: string;
  repo: string;
  type:
    | "repo"
    | "file"
    | "tree"
    | "pull"
    | "issue"
    | "release"
    | "commit"
    | "compare";
  ref?: string;
  path?: string;
  number?: number;
}

function parseGitHubUrl(url: string): GitHubPath | null {
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/(.+))?$/,
  );
  if (!match) return null;

  const [, owner, repo, rest] = match;
  if (!rest) return { owner, repo, type: "repo" };

  return parsePathSegments(owner, repo, rest);
}

function parsePathSegments(
  owner: string,
  repo: string,
  rest: string,
): GitHubPath | null {
  const parts = rest.split("/");
  const first = parts[0].toLowerCase();

  if (first === "blob")
    return {
      owner,
      repo,
      type: "file",
      ref: parts[1],
      path: parts.slice(2).join("/"),
    };
  if (first === "tree")
    return {
      owner,
      repo,
      type: "tree",
      ref: parts[1],
      path: parts.slice(2).join("/"),
    };
  if (first === "compare")
    return { owner, repo, type: "compare", ref: parts.slice(1).join("..") };
  return parseNumberedPath(owner, repo, first, parts);
}

function parsePullPath(
  owner: string,
  repo: string,
  parts: string[],
): GitHubPath | null {
  if (!parts[1]) return null;
  return { owner, repo, type: "pull", number: parseInt(parts[1], 10) };
}

function parseIssuePath(
  owner: string,
  repo: string,
  parts: string[],
): GitHubPath | null {
  if (!parts[1]) return null;
  return { owner, repo, type: "issue", number: parseInt(parts[1], 10) };
}

function parseReleasePath(
  owner: string,
  repo: string,
  parts: string[],
): GitHubPath | null {
  if (parts[1] !== "tag" || !parts[2]) return null;
  return { owner, repo, type: "release", ref: parts[2] };
}

function parseCommitPath(
  owner: string,
  repo: string,
  parts: string[],
): GitHubPath | null {
  if (!parts[1]) return null;
  return { owner, repo, type: "commit", ref: parts[1] };
}

function parseNumberedPath(
  owner: string,
  repo: string,
  first: string,
  parts: string[],
): GitHubPath | null {
  switch (first) {
    case "pull":
      return parsePullPath(owner, repo, parts);
    case "issues":
      return parseIssuePath(owner, repo, parts);
    case "releases":
      return parseReleasePath(owner, repo, parts);
    case "commit":
      return parseCommitPath(owner, repo, parts);
  }
  return null;
}

function spawnGh(args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args, { stdio: ["pipe", "pipe", "pipe"] });

    signal?.addEventListener("abort", () => {
      child.kill("SIGTERM");
      reject(new Error("Aborted"));
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code: number | null) => {
      if (code === 0) resolve(stdout.trim());
      else
        reject(
          new Error(
            `gh ${args.join(" ")} failed (exit ${code}): ${stderr.trim()}`,
          ),
        );
    });
    child.on("error", reject);
  });
}

function buildRefArgs(ref: string): string[] {
  return ref !== "HEAD" ? ["-f", `ref=${ref}`] : [];
}

async function handleFile(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  const ref = parsed.ref ?? "HEAD";
  const b64 = await spawnGh(
    [
      "api",
      "-q",
      ".content",
      `repos/${parsed.owner}/${parsed.repo}/contents/${parsed.path}`,
      ...buildRefArgs(ref),
    ],
    signal,
  );
  return Buffer.from(b64, "base64").toString("utf-8");
}

async function handleTree(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  const ref = parsed.ref ?? "HEAD";
  const entries = await spawnGh(
    [
      "api",
      "-q",
      '.[] | "- \\(.name)"',
      `repos/${parsed.owner}/${parsed.repo}/contents/${parsed.path ?? ""}`,
      ...buildRefArgs(ref),
    ],
    signal,
  );
  return `# ${parsed.path ?? `${parsed.owner}/${parsed.repo}`}\n\n${entries}`;
}

async function handleCompare(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  const diff = await spawnGh(
    [
      "diff",
      "--repo",
      `${parsed.owner}/${parsed.repo}`,
      parsed.ref!,
      "--unified=3",
    ],
    signal,
  );

  const mdLines: string[] = [];
  let inHunk = false;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git")) {
      handleDiffHeader(line, mdLines);
      inHunk = false;
    } else if (line.startsWith("@@ ")) {
      handleHunkStart(mdLines);
      inHunk = true;
    } else {
      const processed = processDiffLine(line, inHunk);
      if (processed !== null) mdLines.push(processed);
    }
  }

  return `# Compare: ${parsed.ref}\n\n${mdLines.join("\n")}`;
}

function handleDiffHeader(line: string, mdLines: string[]): void {
  const m = line.match(/diff --git a\/(.+) b\/(.+)/);
  if (!m) return;
  mdLines.push(
    m[1] !== m[2]
      ? `\n## File rename: \`${m[1]}\` → \`${m[2]}\``
      : `\n## Changes in \`${m[1]}\``,
  );
}

function handleHunkStart(mdLines: string[]): void {
  mdLines.push("");
}

function processDiffLine(line: string, inHunk: boolean): string | null {
  if (line.startsWith("+")) return `+ ${line.slice(1)}`;
  if (line.startsWith("-")) return `- ${line.slice(1)}`;
  if (inHunk && line.length > 0) return `  ${line}`;
  return line.length > 0 ? line : null;
}

async function handlePr(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  return spawnGh(
    [
      "pr",
      "view",
      String(parsed.number),
      "--repo",
      `${parsed.owner}/${parsed.repo}`,
    ],
    signal,
  );
}

async function handleIssue(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  return spawnGh(
    [
      "issue",
      "view",
      String(parsed.number),
      "--repo",
      `${parsed.owner}/${parsed.repo}`,
    ],
    signal,
  );
}

async function handleRelease(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  const raw = await spawnGh(
    [
      "release",
      "view",
      parsed.ref!,
      "--repo",
      `${parsed.owner}/${parsed.repo}`,
      "--json",
      "tag_name,body",
    ],
    signal,
  );
  const { tag_name, body } = JSON.parse(raw) as {
    tag_name: string;
    body: string;
  };
  return `# ${tag_name}\n\n${body}`;
}

async function handleCommit(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  const msg = await spawnGh(
    [
      "api",
      "-q",
      ".commit.message",
      `repos/${parsed.owner}/${parsed.repo}/commits/${parsed.ref}`,
    ],
    signal,
  );
  const meta = `${parsed.owner}/${parsed.repo}@${parsed.ref?.slice(0, 7)}`;
  return `# Commit ${meta}\n\n${msg}`;
}

async function handleRepo(
  parsed: GitHubPath,
  signal?: AbortSignal,
): Promise<string> {
  const info = await spawnGh(
    ["api", "-q", '.description // ""', `repos/${parsed.owner}/${parsed.repo}`],
    signal,
  );
  let readme = "";
  try {
    const b64 = await spawnGh(
      ["api", "-q", ".content", `repos/${parsed.owner}/${parsed.repo}/readme`],
      signal,
    );
    readme = Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    /* no README */
  }
  return readme || info;
}

export const parser: Parser = {
  matches(url: string): boolean {
    return /^https?:\/\/github\.com\//i.test(url);
  },

  async convert(url: string, signal?: AbortSignal): Promise<string> {
    const parsed = parseGitHubUrl(url);
    if (!parsed) throw new Error(`Unable to parse GitHub URL: ${url}`);

    const handlers: Record<GitHubPath["type"], () => Promise<string>> = {
      file: () => handleFile(parsed, signal),
      tree: () => handleTree(parsed, signal),
      compare: () => handleCompare(parsed, signal),
      pull: () => handlePr(parsed, signal),
      issue: () => handleIssue(parsed, signal),
      release: () => handleRelease(parsed, signal),
      commit: () => handleCommit(parsed, signal),
      repo: () => handleRepo(parsed, signal),
    };

    return handlers[parsed.type]();
  },
};
