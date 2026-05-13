import { createRetryFetch, createRetryFetchText } from "../../lib/parser-utils";
import type { HFRepo } from "./types";

const BASE = "https://huggingface.co";
const API = `${BASE}/api`;
const hfFetchOpts = { apiName: "HuggingFace" };

export function repoApiPath(parsed: {
  kind: string;
  owner: string;
  name: string;
}): string {
  return `${parsed.kind}s/${parsed.owner}/${parsed.name}`;
}

export function fetchJSON<T>(
  endpoint: string,
  signal?: AbortSignal,
): Promise<T> {
  return createRetryFetch(hfFetchOpts)(`${API}/${endpoint}`, signal);
}

export function fetchRaw(
  repo: HFRepo,
  revision: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = `${BASE}/${repo.owner}/${repo.name}/resolve/${revision}/${filePath}`;
  return createRetryFetchText(hfFetchOpts)(url, signal);
}

export { BASE };
