import { Type } from "typebox";
import type { Column } from "../../../shared/rendering/types";

export const TypeBoxFields = {
  owner: Type.String({
    description: "Repository owner (e.g., 'facebook')",
  }),
  repoName: Type.String({
    description: "Repository name (e.g., 'react')",
  }),
  path: Type.Optional(
    Type.String({
      description: "Path within repository (default: root)",
    }),
  ),
  ref: Type.Optional(
    Type.String({
      description: "Branch or commit reference (optional)",
    }),
  ),
  searchQuery: Type.String({
    description: "Search query keywords",
  }),
  searchLimit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: "Maximum number of results (max 100)",
    }),
  ),
  listLimit: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 100,
      default: 30,
      description: "Maximum number of items to return (max 100)",
    }),
  ),
  ownerFilter: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on owner",
    }),
  ),
  repoFilter: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on repository",
    }),
  ),
  stateFilter: Type.Optional(
    Type.Union([Type.Literal("open"), Type.Literal("closed")], {
      description: "Filter based on state",
    }),
  ),
  labelFilter: Type.Optional(
    Type.Array(Type.String(), {
      description: "Filter on label",
    }),
  ),
  authorFilter: Type.Optional(
    Type.String({
      description: "Filter by author",
    }),
  ),
  assigneeFilter: Type.Optional(
    Type.String({
      description: "Filter by assignee",
    }),
  ),
  viewNumber: Type.Integer({
    description: "Item number (e.g., 123)",
  }),
};

export const ViewParamsSchema = Type.Object({
  owner: TypeBoxFields.owner,
  repo: TypeBoxFields.repoName,
  number: TypeBoxFields.viewNumber,
});

export function createBasicColumns(
  titleFormatter: (r: Record<string, string>) => string,
): Column[] {
  return [
    { key: "#", align: "right", minWidth: 5 },
    {
      key: "title",
      format(_v: unknown, row: Record<string, unknown>) {
        const r = row as Record<string, string>;
        const dot = r.state === "OPEN" ? "●" : "○";
        return `${dot} ${r.title}\n${titleFormatter(r)}`;
      },
    },
  ];
}

export function createListParamsSchema(
  description: string,
  stateValues: string[],
  itemLabel: string,
): ReturnType<typeof Type.Object> {
  return Type.Object({
    owner: Type.String({
      description: "Repository owner (e.g., 'facebook')",
    }),
    repo: Type.String({
      description: "Repository name (e.g., 'react')",
    }),
    state: Type.Optional(
      Type.Union(
        stateValues.map((v) => Type.Literal(v)),
        {
          description: "Filter by state (default: open)",
        },
      ),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 100,
        default: 30,
        description: `Maximum number of ${itemLabel} to return (max 100)`,
      }),
    ),
  });
}
