import { defineParser } from "../../lib/parser-factory";
import { parseHFUrl } from "./url-parsing";
import type { HFPath } from "./types";
import {
  handleRepo,
  handleFile,
  handleTree,
  handleDiscussion,
} from "./handlers";

const hfHandlers: Record<
  string,
  (p: HFPath, s?: AbortSignal) => Promise<string>
> = {
  file: handleFile,
  tree: handleTree,
  discussion: handleDiscussion,
  discussions: handleDiscussion,
  repo: handleRepo,
};

async function dispatchHF(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  const handler = hfHandlers[parsed.type];
  return handler(parsed, signal);
}

export const huggingfaceParser = defineParser(
  "HuggingFace",
  (url) => /^https?:\/\/huggingface\.co\//i.test(url),
  parseHFUrl,
  dispatchHF,
);
