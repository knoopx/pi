import { defineParser } from "../../lib/parser-factory";
import { parseWikiUrl, type WikiPath } from "./url-parsing";
import { handleArticle } from "./article";
import { handleSearch } from "./search";

function resolveSearchParams(path: WikiPath): {
  query: string;
  lang: string;
  limit: number;
} {
  return { query: path.query ?? "", lang: path.lang, limit: path.limit ?? 10 };
}

async function convertWikiPath(
  path: WikiPath,
  signal?: AbortSignal,
): Promise<string> {
  switch (path.type) {
    case "article":
      if (!path.title) throw new Error("Missing Wikipedia article title");
      return handleArticle(path.title, path.lang, signal);
    case "search": {
      const params = resolveSearchParams(path);
      return handleSearch(params.query, params.lang, params.limit, signal);
    }
  }
}

export const wikipediaParser = defineParser(
  "Wikipedia",
  (url) => /^https?:\/\/[a-z]{2}\.wikipedia\.org\//i.test(url),
  parseWikiUrl,
  convertWikiPath,
);
