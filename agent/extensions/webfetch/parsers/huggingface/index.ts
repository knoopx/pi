import { defineParser } from "../../lib/parser-utils";
import { parseHFUrl } from "./url-parsing";
import type { HFPath } from "./types";
import {
  handleRepo,
  handleFile,
  handleTree,
  handleDiscussion,
} from "./handlers";

async function dispatchHF(
  parsed: HFPath,
  signal?: AbortSignal,
): Promise<string> {
  switch (parsed.type) {
    case "file":
      return handleFile(parsed, signal);
    case "tree":
      return handleTree(parsed, signal);
    case "discussion":
    case "discussions":
      return handleDiscussion(parsed, signal);
    case "repo":
      return handleRepo(parsed, signal);
  }
}

export const huggingfaceParser = defineParser(
  "HuggingFace",
  (url) => /^https?:\/\/huggingface\.co\//i.test(url),
  parseHFUrl,
  dispatchHF,
);
