import { describe, it, expect } from "vitest";
import {
  TypeBoxFields,
  ViewParamsSchema,
  createBasicColumns,
  createListParamsSchema,
} from "./types";

describe("TypeBoxFields", () => {
  it("defines owner as required string", () => {
    expect(TypeBoxFields.owner.type).toBe("string");
  });

  it("defines repoName as required string", () => {
    expect(TypeBoxFields.repoName.type).toBe("string");
  });

  it("defines viewNumber as required integer", () => {
    expect(TypeBoxFields.viewNumber.type).toBe("integer");
  });

  it("defines path as optional string", () => {
    expect(TypeBoxFields.path.type).toBe("string");
  });

  it("defines ref as optional string", () => {
    expect(TypeBoxFields.ref.type).toBe("string");
  });

  it("defines searchLimit with min/max constraints", () => {
    expect(
      (TypeBoxFields.searchLimit as unknown as { minimum: number }).minimum,
    ).toBe(1);
    expect(
      (TypeBoxFields.searchLimit as unknown as { maximum: number }).maximum,
    ).toBe(100);
    expect(
      (TypeBoxFields.searchLimit as unknown as { default: number }).default,
    ).toBe(20);
  });

  it("defines listLimit with min/max constraints", () => {
    expect(
      (TypeBoxFields.listLimit as unknown as { minimum: number }).minimum,
    ).toBe(1);
    expect(
      (TypeBoxFields.listLimit as unknown as { maximum: number }).maximum,
    ).toBe(100);
    expect(
      (TypeBoxFields.listLimit as unknown as { default: number }).default,
    ).toBe(30);
  });

  it("defines ownerFilter as array of strings", () => {
    expect(TypeBoxFields.ownerFilter.items.type).toBe("string");
  });

  it("defines stateFilter as union of open/closed", () => {
    expect(
      (TypeBoxFields.stateFilter as unknown as { anyOf: unknown[] }).anyOf,
    ).toEqual([
      { const: "open", type: "string" },
      { const: "closed", type: "string" },
    ]);
  });
});

describe("ViewParamsSchema", () => {
  it("requires owner, repo, and number fields", () => {
    expect(ViewParamsSchema.required).toContain("owner");
    expect(ViewParamsSchema.required).toContain("repo");
    expect(ViewParamsSchema.required).toContain("number");
  });
});

describe("createBasicColumns", () => {
  it("creates two columns: number and title", () => {
    const columns = createBasicColumns((r) => r.extra || "");
    expect(columns).toHaveLength(2);
    expect(columns[0].key).toBe("#");
    expect(columns[0].align).toBe("right");
    expect(columns[1].key).toBe("title");
  });

  it("formats title with open dot for OPEN state", () => {
    const columns = createBasicColumns((r) => r.extra || "");
    const formatFn = columns[1].format!;
    const result = formatFn(undefined, {
      title: "Fix bug",
      state: "OPEN",
      extra: "extra info",
    });
    expect(result).toContain("●");
    expect(result).toContain("Fix bug");
  });

  it("formats title with closed dot for non-OPEN state", () => {
    const columns = createBasicColumns((r) => r.extra || "");
    const formatFn = columns[1].format!;
    const result = formatFn(undefined, {
      title: "Closed issue",
      state: "CLOSED",
      extra: "",
    });
    expect(result).toContain("○");
    expect(result).toContain("Closed issue");
  });

  it("includes title formatter output in second line", () => {
    const columns = createBasicColumns((r) => `by ${r.author}`);
    const formatFn = columns[1].format!;
    const result = formatFn(undefined, {
      title: "PR title",
      state: "OPEN",
      author: "octocat",
    });
    expect(result).toContain("by octocat");
  });
});

describe("createListParamsSchema", () => {
  it("creates schema with owner, repo, state, and limit", () => {
    const schema = createListParamsSchema(
      "List PRs",
      ["open", "closed", "merged"],
      "PRs",
    );
    expect(schema.required).toContain("owner");
    expect(schema.required).toContain("repo");
  });

  it("includes all state values in union", () => {
    const schema = createListParamsSchema(
      "List issues",
      ["open", "closed"],
      "issues",
    );
    const stateProp = schema.properties.state;
    expect((stateProp as unknown as { anyOf: unknown[] }).anyOf).toHaveLength(
      2,
    );
  });

  it("includes item label in limit description", () => {
    const schema = createListParamsSchema("List releases", [], "releases");
    const limitProp = schema.properties.limit;
    expect((limitProp as { description?: string }).description).toContain(
      "releases",
    );
  });

  it("sets default limit to 30", () => {
    const schema = createListParamsSchema("List PRs", ["open"], "prs");
    expect((schema.properties.limit as { default?: number }).default).toBe(30);
  });

  it("sets limit max to 100", () => {
    const schema = createListParamsSchema("List PRs", ["open"], "prs");
    expect((schema.properties.limit as { maximum?: number }).maximum).toBe(100);
  });
});
