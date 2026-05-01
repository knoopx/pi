import type { Parser, ParseResult } from "./types";
import { arxivParser } from "../parsers/arxiv";
import { githubParser } from "../parsers/github";
import { huggingfaceParser } from "../parsers/huggingface";
import { hackernewsParser } from "../parsers/hackernews";
import { npmParser } from "../parsers/npm";
import { pdfParser } from "../parsers/pdf";
import { pypiParser } from "../parsers/pypi";
import { redditParser } from "../parsers/reddit";
import { stackoverflowParser } from "../parsers/stackoverflow";
import { wikipediaParser } from "../parsers/wikipedia";
import { youtubeParser } from "../parsers/youtube";
import { genericParser } from "../parsers/generic";
const PARSERS: readonly Parser[] = [
  arxivParser,
  githubParser,
  huggingfaceParser,
  hackernewsParser,
  npmParser,
  pdfParser,
  pypiParser,
  redditParser,
  stackoverflowParser,
  wikipediaParser,
  youtubeParser,
  genericParser,
];
export async function parse(
  source: string,
  signal?: AbortSignal,
): Promise<ParseResult> {
  for (const p of PARSERS) {
    if (p.matches(source)) return p.convert(source, signal);
  }

  throw new Error(`No parser found for: ${source}`);
}
