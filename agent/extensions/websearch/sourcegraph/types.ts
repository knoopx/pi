import { Type, type Static } from "typebox";
import { TypeBoxFields } from "../../gh/lib/types";

export interface SourcegraphResult {
  repo: string;
  path: string;
  line: number;
  snippet: string;
  language: string;
  stars: number;
  url: string;
}

export const SearchSourcegraphParams = Type.Object({
  query: TypeBoxFields.searchQuery,
  limit: TypeBoxFields.searchLimit,
  language: Type.Optional(
    Type.String({
      description: "Filter results by language",
    }),
  ),
});

export type SearchSourcegraphParamsType = Static<
  typeof SearchSourcegraphParams
>;
