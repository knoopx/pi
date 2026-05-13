import { defineParser } from "../../lib/parser-utils";
import { parseWikiUrl, type WikiPath } from "./url-parsing";
import { handleArticle } from "./article";
import { handleSearch } from "./search";

async function convertWikiPath(
  path: WikiPath,
  signal?: AbortSignal,
): Promise<string> {
  switch (path.type) {
    case "article":
      if (!path.title) throw new Error("Missing Wikipedia article title");
      return handleArticle(path.title, path.lang, signal);
    case "search":
      return handleSearch(
        path.query ?? "",
        path.lang,
        path.limit ?? 10,
        signal,
      );
  }
}

export const wikipediaParser = defineParser(
  "Wikipedia",
  (url) => /^https?:\/\/[a-z]{2}\.wikipedia\.org\//i.test(url),
  parseWikiUrl,
  convertWikiPath,
);
