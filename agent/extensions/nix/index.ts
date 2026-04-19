import type {
  AgentToolResult,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { searchNixPackages, mapPackage, formatPackageTable } from "./packages";
import {
  searchNixOptions,
  searchHomeManagerOptions,
  mapNixOption,
  mapHomeManagerOption,
  buildOptionTableRenderer,
} from "./options";

// Parameter schema for search queries
const SearchQueryParams = Type.Object({
  query: Type.String({
    description: "Search query (option name or description)",
  }),
});

type SearchQueryParamsType = Static<typeof SearchQueryParams>;

type NixToolExecute = (
  _toolCallId: string,
  params: SearchQueryParamsType,
) => Promise<AgentToolResult<Record<string, unknown>>>;

interface CreateToolMeta {
  name: string;
  label: string;
  description: string;
}


function createTool<T>(
  meta: CreateToolMeta,
  searchFn: (q: string) => Promise<T[]>,
  mapper: (item: T) => Record<string, string>,
  contentBuilder: (res: Record<string, string>[]) => string,
): {
  name: string;
  label: string;
  description: string;
  parameters: typeof SearchQueryParams;
  execute: NixToolExecute;
} {
  return {
    name: meta.name,
    label: meta.label,
    description: meta.description,
    parameters: SearchQueryParams,
    async execute(
      _toolCallId: string,
      params: SearchQueryParamsType,
    ): Promise<AgentToolResult<Record<string, unknown>>> {
      const { executeSearchTool } = await import("./options");
      return executeSearchTool(
        searchFn as never,
        mapper,
        contentBuilder,
        params.query,
      );
    },
  };
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool(
    createTool(
      {
        name: "search-nix-packages",
        label: "Search Nix Packages",
        description: `Find packages available in the NixOS package repository.

Use this to:
- Discover software packages for installation
- Check package versions and descriptions
- Find packages by name or functionality
- Get package metadata and maintainers

Returns detailed package information from nixpkgs.`,
      },
      searchNixPackages,
      mapPackage,
      formatPackageTable,
    ),
  );

  pi.registerTool(
    createTool(
      {
        name: "search-nix-options",
        label: "Search Nix Options",
        description: `Find configuration options available in NixOS.

Use this to:
- Discover system configuration settings
- Find options for services and modules
- Check option types and default values
- Get examples for configuration

Returns NixOS configuration option details.`,
      },
      searchNixOptions,
      mapNixOption,
      buildOptionTableRenderer(false),
    ),
  );

  pi.registerTool(
    createTool(
      {
        name: "search-home-manager-options",
        label: "Search Home-Manager Options",
        description: `Find configuration options for Home Manager.

Use this to:
- Configure user-specific settings
- Set up dotfiles and user programs
- Customize desktop environment
- Manage user-level services

Returns Home Manager configuration options.`,
      },
      searchHomeManagerOptions,
      mapHomeManagerOption,
      buildOptionTableRenderer(true),
    ),
  );
}
