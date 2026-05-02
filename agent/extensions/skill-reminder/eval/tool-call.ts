import type { ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { embedTexts, cosine } from "../../../shared/embeddings/engine";
import { loadConfig } from "../config";
import { buildQuery } from "../query-builder";
import { scoreAndRank } from "../scorer";
import { buildReminder, formatHits } from "../reminder";
import { loadIndex, printMatches } from "./shared";

function printReminder(
  hits: Array<{
    score: number;
    skill: string;
    file: string;
    section: string;
    text: string;
  }>,
) {
  if (hits.length === 0) {
    console.log("No relevant skills found.\n");
    return;
  }

  const reminder = buildReminder(hits);
  console.log("=== Reminder Preview ===\n");
  console.log(reminder);
  console.log();
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}

function parseEvent(input: string): ToolResultEvent {
  const raw = JSON.parse(input);
  return {
    type: "tool_result" as const,
    toolCallId: raw.toolCallId ?? "eval-test",
    toolName: raw.toolName,
    isError: true,
    input: raw.input ?? {},
    content: raw.content ?? [],
    details: undefined,
  };
}

async function getEvent(): Promise<ToolResultEvent> {
  const input = process.argv.slice(2).join(" ");
  if (!input) {
    console.error("Usage: bun run eval/tool-call.ts <json-event>");
    console.error("\nExample:");
    console.error(
      'bun run eval/tool-call.ts \'{"toolName":"bash","input":{"command":"npm run build"},"content":[{"type":"text","text":"error: command not found"}],"isError":true}\'',
    );
    console.error(
      '\nOr pipe JSON: echo \'{"toolName":"read","input":{"path":"/some/file.ts"}}\' | bun run eval/tool-call.ts -',
    );
    process.exit(1);
  }
  return input === "-" ? parseEvent(await readStdin()) : parseEvent(input);
}

function displayEvent(event: ToolResultEvent): void {
  console.log(`Tool: "${event.toolName}"`);
  console.log(`Input: ${JSON.stringify(event.input, null, 2)}`);
  if (event.content?.length) {
    console.log(`Content: ${JSON.stringify(event.content, null, 2)}`);
  }
  console.log();
}

function deduplicate<T extends { file: string; section: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = `${s.file}#${s.section}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface ScoredHit {
  score: number;
  skill: string;
  file: string;
  section: string;
  text: string;
}

async function getScoredHits(
  index: Awaited<ReturnType<typeof loadIndex>>,
  embedding: number[],
  threshold: number,
): Promise<ScoredHit[]> {
  const scored = index
    .map((chunk) => ({
      score: cosine(embedding, chunk.embedding),
      skill: chunk.skill!,
      file: chunk.file,
      section: chunk.section,
      text: chunk.text,
    }))
    .filter((s) => s.score > threshold);

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);
  return deduplicate(scored);
}

async function main(): Promise<void> {
  const config = await loadConfig();
  const index = await loadIndex();
  const event = await getEvent();

  displayEvent(event);

  const query = buildQuery(event);
  console.log("=== Built Query ===\n");
  console.log(query);
  console.log();

  const embedding = (await embedTexts([query], config))[0];
  printMatches(index, embedding);

  const deduped = await getScoredHits(index, embedding, config.scoreThreshold);
  if (deduped.length === 0) {
    console.log("\nNo hits above threshold.");
    return;
  }

  printReminder(deduped.slice(0, config.maxSkills));
}

main().catch(console.error);
