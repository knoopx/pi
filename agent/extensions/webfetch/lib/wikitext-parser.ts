import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import type { Root as MdastRoot } from "mdast";
import { createWikitextSyntax } from "./wikitext-tokenizers";
import { createWikitextFromMarkdown } from "./wikitext-from-markdown";

export function parseWikitext(wikitext: string): MdastRoot {
  const syntax = createWikitextSyntax();
  const fromMarkdownExt = createWikitextFromMarkdown();

  // @ts-expect-error custom extension types don't match micromark types exactly
  return fromMarkdown(wikitext, {
    extensions: [syntax],
    mdastExtensions: [fromMarkdownExt, gfmFromMarkdown()],
  });
}
