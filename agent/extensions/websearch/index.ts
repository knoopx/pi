import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import type { Column } from "../../shared/rendering/types";
import { textResult } from "../../shared/result/tool";
import { dotJoin, countLabel } from "../../shared/rendering/labels";
import { table } from "../../shared/rendering/table/renderer";
import type { SearchResult } from "./duckduckgo/types";
import { searchDuckDuckGo } from "./duckduckgo/search";
import { singleLine } from "./duckduckgo/parsing";
import {
  SearchHuggingfaceModelsParams,
  type SearchHuggingfaceModelsParamsType,
  searchHuggingfaceModels,
} from "./huggingface/models";
import {
  SearchNpmPackagesParams,
  type SearchNpmPackagesParamsType,
  executeNpmSearch,
} from "./npm/search";
import {
  SearchPyPIPackagesParams,
  type SearchPyPIPackagesParamsType,
  executeSearchPackages,
} from "./pypi/search";
import {
  searchNixPackages,
  mapPackage,
  formatPackageTable,
} from "./nix/packages";
import {
  searchNixOptions,
  searchHomeManagerOptions,
  mapNixOption,
  mapHomeManagerOption,
  buildOptionTableRenderer,
} from "./nix/options";
import { registerGithubSearchTools } from "./github/registration";
import {
  searchSourcegraph,
  SearchSourcegraphParams,
} from "./sourcegraph/search";
import { formatSourcegraphResult } from "./sourcegraph/formatting";
import {
  searchContext7,
  resolveContext7Library,
  SearchContext7Params,
} from "./context7/search";
import { formatContext7Result, formatLibraryList } from "./context7/formatting";

const searchCols: Column[] = [
  { key: "#", align: "right", minWidth: 3 },
  {
    key: "title",
    format(_v, row) {
      const r = row as { title: string; url: string; description: string };
      const lines = [r.title];
      if (r.description) lines.push(r.description);
      lines.push(r.url);
      return lines.join("\n");
    },
  },
];

function createSearchHandler<P extends { query: string }, R>(
  searchFn: (params: P) => Promise<R>,
  formatter: (result: R) => string,
  resultKey: string,
): (_toolCallId: string, params: P) => Promise<ReturnType<typeof textResult>> {
  return async (_toolCallId, params) => {
    try {
      const result = await searchFn(params);
      const output = formatter(result);
      return textResult(output, {
        query: params.query,
        [resultKey]: (result as Record<string, unknown>)[resultKey] ?? [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return textResult(`Error: ${message}`, {
        query: params.query,
        [resultKey]: [],
      });
    }
  };
}

function formatSearchOutput(query: string, results: SearchResult[]): string {
  const rows = results.map((r, i) => ({
    "#": String(i + 1),
    title: singleLine(r.title) || "(untitled)",
    url: r.url,
    description: singleLine(r.description),
  }));

  return [
    dotJoin(countLabel(results.length, "result")),
    "",
    table(searchCols, rows),
  ].join("\n");
}

const SearchWebParams = Type.Object({
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(
    Type.Number({ description: "Number of results (default 10)" }),
  ),
});
type SearchWebParamsType = Static<typeof SearchWebParams>;

const NixQueryParams = Type.Object({
  query: Type.String({
    description: "Search query (option name or description)",
  }),
});
type NixQueryParamsType = Static<typeof NixQueryParams>;

async function executeNixSearchTool<T, U extends Record<string, string>>(
  _toolCallId: string,
  params: NixQueryParamsType,
  searchFn: (q: string) => Promise<T[]>,
  mapper: (item: T) => U,
  contentBuilder: (res: U[]) => string,
): Promise<ReturnType<typeof textResult>> {
  try {
    const items = await searchFn(params.query);
    const results = items.slice(0, 20).map(mapper);
    const content = contentBuilder(results);
    return textResult(content, {
      query: params.query,
      totalFound: results.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return textResult(`Error: ${message}`, {});
  }
}

export default function (pi: ExtensionAPI): void {
  registerGithubSearchTools(pi);
  pi.registerTool({
    name: "web-search",
    label: "Search DuckDuckGo",
    description: `Search using DuckDuckGo search engine.`,
    parameters: SearchWebParams,

    async execute(_toolCallId: string, params: SearchWebParamsType) {
      try {
        const { query, limit = 10 } = params;
        const results = await searchDuckDuckGo(query, limit);

        if (results.length === 0)
          return textResult("No results found.", { query, limit, results: [] });
        const text = formatSearchOutput(query, results);
        return textResult(text, { query, limit, results });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return textResult(`Error: ${message}`, {
          query: params.query,
          results: [],
        });
      }
    },
  });

  pi.registerTool({
    name: "npm-search-packages",
    label: "Search NPM Packages",
    description: `Search for packages available on the npm registry.`,
    parameters: SearchNpmPackagesParams,

    async execute(_toolCallId: string, params: SearchNpmPackagesParamsType) {
      return executeNpmSearch(_toolCallId, params);
    },
  });

  pi.registerTool({
    name: "pypi-search-packages",
    label: "Search PyPI Packages",
    description: `Search for Python packages available on PyPI.`,
    parameters: SearchPyPIPackagesParams,

    async execute(_toolCallId: string, params: SearchPyPIPackagesParamsType) {
      return executeSearchPackages(_toolCallId, params);
    },
  });

  pi.registerTool({
    name: "nix-search-packages",
    label: "Search Nix Packages",
    description: `Find packages available in the NixOS package repository.`,
    parameters: NixQueryParams,

    async execute(_toolCallId: string, params: NixQueryParamsType) {
      return executeNixSearchTool(
        _toolCallId,
        params,
        searchNixPackages,
        mapPackage,
        formatPackageTable,
      );
    },
  });

  pi.registerTool({
    name: "nix-search-options",
    label: "Search Nix Options",
    description: `Find configuration options available in NixOS.`,
    parameters: NixQueryParams,

    async execute(_toolCallId: string, params: NixQueryParamsType) {
      return executeNixSearchTool(
        _toolCallId,
        params,
        searchNixOptions,
        mapNixOption,
        buildOptionTableRenderer(false),
      );
    },
  });

  pi.registerTool({
    name: "hm-search-options",
    label: "Search Home-Manager Options",
    description: `Find configuration options for Home Manager.`,
    parameters: NixQueryParams,

    async execute(_toolCallId: string, params: NixQueryParamsType) {
      return executeNixSearchTool(
        _toolCallId,
        params,
        searchHomeManagerOptions,
        mapHomeManagerOption,
        buildOptionTableRenderer(true),
      );
    },
  });

  pi.registerTool({
    name: "hf-search-models",
    label: "HuggingFace Search",
    description:
      "Search Hugging Face models by tags, author, pipeline, or library. Returns model ID, downloads, likes, and tags.",
    parameters: SearchHuggingfaceModelsParams,

    async execute(_toolCallId, params, signal) {
      return searchHuggingfaceModels(
        params as SearchHuggingfaceModelsParamsType,
        signal,
      );
    },
  });

  pi.registerTool({
    name: "sg-search-code",
    label: "Sourcegraph Code Search",
    description: `Search for code across open-source repositories using Sourcegraph.`,
    parameters: SearchSourcegraphParams,

    execute: createSearchHandler(
      searchSourcegraph,
      formatSourcegraphResult,
      "results",
    ),
  });

  pi.registerTool({
    name: "ctx7-search-docs",
    label: "Context7 Docs Search",
    description: `Search library documentation via Context7.`,
    parameters: SearchContext7Params,

    execute: createSearchHandler(
      searchContext7,
      formatContext7Result,
      "results",
    ),
  });

  pi.registerTool({
    name: "ctx7-resolve-library",
    label: "Context7 Resolve Library",
    description: `Resolve a library name to Context7 library IDs.`,
    parameters: Type.Object({
      query: Type.String({
        description: "Library name to resolve",
      }),
    }),

    execute: createSearchHandler(
      async (params: { query: string }) => resolveContext7Library(params.query),
      formatLibraryList,
      "libraries",
    ),
  });
}
