import { throttledFetch } from "../../../shared/network/throttle";

const HF_API = "https://huggingface.co/api";
const HF_BASE = "https://huggingface.co";
const HF_UA = { "User-Agent": "pi-huggingface-tool/1.0" };

export { HF_API, HF_BASE };

export async function hfFetch<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await throttledFetch(url, { signal, headers: HF_UA });
  if (!response.ok) throw new Error(`HF API returned HTTP ${response.status}`);
  return (await response.json()) as T;
}

export function parseCsv(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export function isWithinLastDays(
  iso: string | undefined,
  days: number,
): boolean {
  if (!iso) return false;
  if (!Number.isFinite(days) || days < 1) return true;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= days * 86_400_000;
}

export function matchesText(
  value: string | undefined,
  needle: string | undefined,
): boolean {
  if (!needle) return true;
  if (!value) return false;
  return value.toLowerCase().includes(needle.toLowerCase());
}
