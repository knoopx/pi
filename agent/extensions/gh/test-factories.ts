import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

export type FieldDef = { label: string; value: string };

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");

export function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf-8")) as T;
}

export function assertCommonFieldLabels(fields: FieldDef[]): void {
  const labels = fields.map((f) => f.label);
  expect(labels).toContain("title");
  expect(labels).toContain("state");
  expect(labels).toContain("author");
}

export function assertTitleWithNumberPrefix(
  fields: FieldDef[],
  expected: string,
): void {
  const titleField = fields.find((f) => f.label === "title");
  expect(titleField).toBeDefined();
  expect((titleField ?? { value: "" }).value).toBe(expected);
}

export function assertFieldValue(
  fields: FieldDef[],
  label: string,
  expected: string,
): void {
  const field = fields.find((f) => f.label === label);
  expect(field).toBeDefined();
  expect((field ?? { value: "" }).value).toBe(expected);
}

export function assertHasCreatedAndUrl(fields: FieldDef[]): void {
  const labels = fields.map((f) => f.label);
  expect(labels).toContain("created");
  expect(labels).toContain("url");
}
