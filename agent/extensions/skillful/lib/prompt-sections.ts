// Prompt sections — intro is inline (single line), rest loaded from files.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const promptsDir = join(here, "prompts");

function load(name: string): string {
  return readFileSync(join(promptsDir, name), "utf-8").trim();
}

export const introSection = `You are an expert coding assistant, operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.`;
export const groundingSources = load("grounding.md");
export const agentWorkflow = load("workflow.md");
