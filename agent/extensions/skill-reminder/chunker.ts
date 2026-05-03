import { relative } from "node:path";
import { homedir } from "node:os";
import { resolve } from "node:path";
export {
  parseMarkdown,
  chunkByElements,
  stripFrontmatter,
} from "../../shared/embeddings/chunker";

export const SKILLS_DIR = resolve(homedir(), ".pi", "agent", "skills");

export function deriveSkillName(filePath: string): string | null {
  const rel = relative(SKILLS_DIR, filePath);
  const parts = rel.split(/[/\\]/);
  return parts.length >= 1 ? parts[0] : null;
}
