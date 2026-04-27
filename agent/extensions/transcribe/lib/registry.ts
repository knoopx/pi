import type { ParseResult, Parser } from "./types";

const PARSERS: Parser[] = [];
let discovered = false;

const OPTIONAL_PARSERS = [
  "arxiv",
  "github",
  "huggingface",
  "hackernews",
  "reddit",
  "stackoverflow",
  "wikipedia",
] as const;

async function loadParser(name: string): Promise<void> {
  try {
    const m = (await import(`../parsers/${name}.js`)) as { parser: Parser };
    PARSERS.push(m.parser);
  } catch {
    /* optional parser not available */
  }
}

async function discoverParsers(): Promise<void> {
  if (discovered) return;
  discovered = true;

  await Promise.all(OPTIONAL_PARSERS.map((name) => loadParser(name)));

  // Generic parser is required
  try {
    const m = (await import("../parsers/generic.js")) as { parser: Parser };
    PARSERS.push(m.parser);
  } catch {
    throw new Error("Generic parser is required but could not be loaded");
  }
}

export async function parse(
  source: string,
  signal?: AbortSignal,
): Promise<ParseResult> {
  await discoverParsers();

  for (const p of PARSERS) {
    if (p.matches(source)) return p.convert(source, signal);
  }

  throw new Error(`No parser found for: ${source}`);
}
