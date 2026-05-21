import { parse } from "yaml";

export interface Frontmatter {
  [key: string]: string | string[] | number | boolean | undefined;
}

export interface ParsedSkill {
  frontmatter: Frontmatter;
  body: string;
}

export function parseSkillFile(text: string): ParsedSkill | null {
  const parts = text.split("---");
  if (parts.length < 3) return null;
  const fmText = parts[1].trim();
  const body = parts.slice(2).join("---").trim();

  const fm = parse(fmText);
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) return null;

  return { frontmatter: fm as Frontmatter, body };
}
