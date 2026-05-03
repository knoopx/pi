export function formatIsoAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function extractLicense(
  tags: string[],
  cardData?: { license?: unknown },
): string | null {
  if (cardData?.license) return String(cardData.license);
  const tag = tags.find((t) => t.startsWith("license:"));
  return tag ? tag.replace("license:", "") : null;
}

export function formatAge(timestamp: number): string {
  const ageMinutes = Math.floor((Date.now() / 1000 - timestamp) / 60);
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return `${ageHours}h ago`;
  const ageDays = Math.floor(ageHours / 24);
  if (ageDays < 30) return `${ageDays}d ago`;
  const ageMonths = Math.floor(ageDays / 30);
  return `${ageMonths}mo ago`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function filterUserTags(tags: string[]): string[] {
  return tags.filter(
    (t) =>
      !t.startsWith("base_model:") &&
      !t.startsWith("license:") &&
      !t.startsWith("arxiv:") &&
      !t.startsWith("deploy:") &&
      !t.startsWith("dataset:") &&
      t !== "region:us" &&
      t !== "endpoints_compatible",
  );
}

export function formatDownloadsShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count !== 1 ? "s" : ""}`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div)[^>]*>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\t/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
