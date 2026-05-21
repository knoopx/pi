export function extractLicense(
  tags: string[],
  cardData?: { license?: unknown },
): string | null {
  if (cardData?.license) return String(cardData.license);
  const tag = tags.find((t) => t.startsWith("license:"));
  return tag ? tag.replace("license:", "") : null;
}

const EXCLUDED_PREFIXES = new Set([
  "base_model:",
  "license:",
  "arxiv:",
  "deploy:",
  "dataset:",
]);
const EXCLUDED_TAGS = new Set(["region:us", "endpoints_compatible"]);

export function filterUserTags(tags: string[]): string[] {
  return tags.filter((t) => !shouldExcludeTag(t));
}

function shouldExcludeTag(tag: string): boolean {
  if (EXCLUDED_TAGS.has(tag)) return true;
  for (const prefix of EXCLUDED_PREFIXES) {
    if (tag.startsWith(prefix)) return true;
  }
  return false;
}
