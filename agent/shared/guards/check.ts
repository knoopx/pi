export interface TextContentItem {
  type: "text";
  text?: string;
}

export function isTextContent(item: unknown): item is TextContentItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    (item as { type: string }).type === "text"
  );
}
