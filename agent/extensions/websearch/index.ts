import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { Type } from "typebox";
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
    description: `Search using DuckDuckGo search engine.

Use this to:
- Find web pages and articles
- Discover content on the internet
- Get search results with metadata

Returns search results with titles, URLs, and descriptions.`,
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
    description: `Search for packages available on the npm registry.

Use this to:
- Find JavaScript/TypeScript packages
- Discover libraries and frameworks
- Check package descriptions and keywords
- Explore npm ecosystem

Returns matching packages with metadata.`,
    parameters: SearchNpmPackagesParams,

    async execute(_toolCallId: string, params: SearchNpmPackagesParamsType) {
      return executeNpmSearch(_toolCallId, params);
    },
  });

  pi.registerTool({
    name: "pypi-search-packages",
    label: "Search PyPI Packages",
    description: `Search for Python packages available on PyPI.

Use this to:
- Find packages by name or functionality
- Discover libraries for specific tasks
- Check package descriptions and versions
- Explore available Python packages

Returns matching packages with metadata.`,
    parameters: SearchPyPIPackagesParams,

    async execute(_toolCallId: string, params: SearchPyPIPackagesParamsType) {
      return executeSearchPackages(_toolCallId, params);
    },
  });

  pi.registerTool({
    name: "nix-search-packages",
    label: "Search Nix Packages",
    description: `Find packages available in the NixOS package repository.

Use this to:
- Discover software packages for installation
- Check package versions and descriptions
- Find packages by name or functionality
- Get package metadata and maintainers

Returns detailed package information from nixpkgs.`,
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
    description: `Find configuration options available in NixOS.

Use this to:
- Discover system configuration settings
- Find options for services and modules
- Check option types and default values
- Get examples for configuration

Returns NixOS configuration option details.`,
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
    description: `Find configuration options for Home Manager.

Use this to:
- Configure user-specific settings
- Set up dotfiles and user programs
- Customize desktop environment
- Manage user-level services

Returns Home Manager configuration options.`,
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
      "Search Hugging Face models. Filter by tags like 'gguf', 'text-generation', 'llama'. Returns model ID, downloads, likes, and tags.",
    parameters: SearchHuggingfaceModelsParams,

    async execute(_toolCallId, params, signal) {
      return searchHuggingfaceModels(
        params as SearchHuggingfaceModelsParamsType,
        signal,
      );
    },
  });
}
