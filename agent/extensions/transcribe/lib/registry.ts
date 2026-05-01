import type { ParseResult } from "./types";
import { parser as arxivParser } from "../parsers/arxiv.js";
import { parser as githubParser } from "../parsers/github.js";
import { parser as huggingfaceParser } from "../parsers/huggingface.js";
import { parser as hackernewsParser } from "../parsers/hackernews.js";
import { parser as redditParser } from "../parsers/reddit.js";
import { parser as stackoverflowParser } from "../parsers/stackoverflow.js";
import { parser as wikipediaParser } from "../parsers/wikipedia.js";
import { parser as genericParser } from "../parsers/generic.js";

const PARSERS = [
  arxivParser,
  githubParser,
  huggingfaceParser,
  hackernewsParser,
  redditParser,
  stackoverflowParser,
  wikipediaParser,
  genericParser,
] as const;

export async function parse(
  source: string,
  signal?: AbortSignal,
): Promise<ParseResult> {
  for (const p of PARSERS) {
    if (p.matches(source)) return p.convert(source, signal);
  }

  throw new Error(`No parser found for: ${source}`);
}
