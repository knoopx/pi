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
