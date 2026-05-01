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
