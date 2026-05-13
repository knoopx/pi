export function extractLicense(
  tags: string[],
  cardData?: { license?: unknown },
): string | null {
  if (cardData?.license) return String(cardData.license);
  const tag = tags.find((t) => t.startsWith("license:"));
  return tag ? tag.replace("license:", "") : null;
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
