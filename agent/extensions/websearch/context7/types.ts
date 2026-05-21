import { Type, type Static } from "typebox";

export interface Context7Library {
  id: string;
  title: string;
  description: string;
  totalSnippets: number;
  trustScore: number;
  versions: string[];
}

export interface Context7DocResult {
  library: string;
  title: string;
  snippet: string;
  url: string;
  type: "code" | "info";
  language?: string;
}

export const SearchContext7Params = Type.Object({
  query: Type.String({ description: "Documentation search query or library name" }),
  library: Type.Optional(
    Type.String({
      description:
        "Context7 library ID (e.g. '/charmbracelet/glamour'), skips auto-resolve",
    }),
  ),
  tokens: Type.Optional(
    Type.Integer({
      minimum: 500,
      maximum: 16000,
      default: 4000,
      description: "Token budget for response (default 4000)",
    }),
  ),
});

export type SearchContext7ParamsType = Static<typeof SearchContext7Params>;
