export function dotJoin(...segments: string[]): string {
  return segments.join(" • ");
}

export function stateDot(
  state: "on" | "off" | "warning" | "inactive" | boolean,
): string {
  return state === "off" || state === "inactive" || state === false ? "○" : "●";
}

export function countLabel(n: number | string, noun: string): string {
  return `${n} ${noun}(s)`;
}
