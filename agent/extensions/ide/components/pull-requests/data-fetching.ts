import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { PullRequest } from "./types";

export async function fetchPullRequests(
  pi: ExtensionAPI,
  cwd: string,
  state: "open" | "closed" | "merged" | "all" = "open",
): Promise<PullRequest[]> {
  const args = buildPrListArgs(state);
  const result = await pi.exec("gh", args, { cwd });
  if (result.code !== 0)
    throw new Error(result.stderr || "Failed to fetch pull requests");

  const data = parsePrResponse(result.stdout);
  return data.map(toPullRequest);
}

function buildPrListArgs(
  state: "open" | "closed" | "merged" | "all",
): string[] {
  const args = [
    "pr",
    "list",
    "--json",
    "number,title,state,isDraft,author,headRefName,baseRefName,createdAt,updatedAt,additions,deletions,reviewDecision,url,body",
    "--limit",
    "100",
  ];
  if (state !== "all") args.push(`--state=${state}`);
  return args;
}

interface RawPr {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  author: { login: string };
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
  url: string;
  body: string;
}

function parsePrResponse(stdout: string): RawPr[] {
  try {
    return JSON.parse(stdout) as RawPr[];
  } catch {
    throw new Error("Failed to parse pull request data");
  }
}

function toPullRequest(pr: RawPr): PullRequest {
  return {
    id: String(pr.number),
    label: pr.title,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    isDraft: pr.isDraft,
    author: pr.author.login,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    additions: pr.additions,
    deletions: pr.deletions,
    reviewDecision: pr.reviewDecision,
    url: pr.url,
    body: pr.body,
  };
}
