import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import type { Root as MdastRoot } from "mdast";
import type { Options as FromMdOptions } from "mdast-util-from-markdown";
import { createWikitextSyntax } from "./wikitext-tokenizers";
import { createWikitextFromMarkdown } from "./wikitext-from-markdown";

export function parseWikitext(wikitext: string): MdastRoot {
  const syntax = createWikitextSyntax();
  const fromMarkdownExt = createWikitextFromMarkdown();

  // Custom wikitext extensions are structurally compatible with micromark at runtime
  // but have types that don't match the Extension interface exactly.
  const opts = {
    extensions: [syntax],
    mdastExtensions: [fromMarkdownExt, gfmFromMarkdown()],
  } as FromMdOptions;
  return fromMarkdown(wikitext, null, opts);
}
