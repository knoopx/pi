export function dotJoin(...segments: string[]): string {
  return segments.join(" • ");
}
function termWidth(fallback: number): number {
  return process.stdout.columns ?? fallback;
}
export function sectionDivider(label?: string, width?: number): string {
  const w = width ?? termWidth(60);
  if (!label) {
    return "─".repeat(w);
  }
  const prefix = "─── ";
  const labelPart = `${label} `;
  const remaining = Math.max(0, w - prefix.length - labelPart.length);
  return prefix + labelPart + "─".repeat(remaining);
}
export function threadSeparator(
  author: string,
  date: string,
  suffix?: string,
  width?: number,
): string {
  const w = width ?? termWidth(60);
  let label = `── ${author} • ${date}`;
  if (suffix) label += ` • ${suffix}`;
  label += " ";
  const remaining = Math.max(0, w - label.length);
  return label + "─".repeat(remaining);
}

export function stateDot(
  state: "on" | "off" | "warning" | "inactive" | boolean,
): string {
  return state === "off" || state === "inactive" || state === false ? "○" : "●";
}
export function countLabel(n: number | string, noun: string): string {
  return `${n} ${noun}(s)`;
}

export interface AuthorBadgeProps {
  name: string;
  fullname?: string;
  type?: string;
  isPro?: boolean;
  isHf?: boolean;
  isOrgMember?: boolean;
}

export function fmtAuthorBase(a: AuthorBadgeProps): string[] {
  const parts = [a.name];
  if (a.fullname && a.fullname !== a.name) parts.push(`(${a.fullname})`);
  const badges: string[] = [];
  if (a.type === "org") badges.push("org");
  if (a.isPro) badges.push("PRO");
  if (a.isHf) badges.push("HF staff");
  if (a.isOrgMember) badges.push("member");
  if (badges.length) parts.push(`[${badges.join(", ")}]`);
  return parts;
}
