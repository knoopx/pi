import { visibleWidth } from "@mariozechner/pi-tui";

export function formatCost(cost: number): string {
  if (cost === 0) return "-";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(2)}`;
  if (cost < 10) return `$${cost.toFixed(2)}`;
  if (cost < 100) {
    const truncated = Math.floor(cost * 10) / 10;
    return `$${truncated.toFixed(1)}`;
  }
  return `$${Math.round(cost)}`;
}

export function formatTokens(count: number): string {
  if (count === 0) return "-";
  if (count < 1000) return count.toString();
  if (count < 10000) {
    const truncated = Math.floor(count / 100) / 10;
    return `${truncated.toFixed(1)}k`;
  }
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count < 1000000000) return `${Math.round(count / 1000000)}M`;
  if (count < 10000000000) return `${(count / 1000000000).toFixed(1)}B`;
  return `${Math.round(count / 1000000000)}B`;
}

export function formatNumber(n: number): string {
  if (n === 0) return "-";
  return new Intl.NumberFormat("en-US").format(n);
}

export function padLeft(s: string, len: number): string {
  const vis = visibleWidth(s);
  if (vis >= len) return s;
  return " ".repeat(len - vis) + s;
}

export function padRight(s: string, len: number): string {
  const vis = visibleWidth(s);
  if (vis >= len) return s;
  return s + " ".repeat(len - vis);
}
