import { test, expect } from "vitest";

import { LogParams } from "./log-experiment/validate";

function collectKeyPaths(
  value: unknown,
  targetKey: string,
  path: string = "$",
  hits: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectKeyPaths(item, targetKey, `${path}[${index}]`, hits),
    );
    return hits;
  }

  if (!value || typeof value !== "object") {
    return hits;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (key === targetKey) {
      hits.push(childPath);
    }
    collectKeyPaths(child, targetKey, childPath, hits);
  }

  return hits;
}

test("log-experiment schema should avoid patternProperties for Cloud Code Assist compatibility", () => {
  const patternPropertyPaths = collectKeyPaths(LogParams, "patternProperties");

  expect(patternPropertyPaths.length).toBe(0);

  const serialized = JSON.stringify(LogParams);
  expect(serialized).toMatch(/"additionalProperties"/);
});
