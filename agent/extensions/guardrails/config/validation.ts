import type { GuardrailsGroup } from "../types";

function isStringField(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "string";
}

function isOptionalStringField(
  obj: Record<string, unknown>,
  key: string,
): boolean {
  const val = obj[key];
  return val === undefined || typeof val === "string";
}

function isValidScope(scope: unknown): boolean {
  if (scope === undefined) return true;
  return scope === "project" || scope === "external";
}

function isValidAction(action: unknown): boolean {
  return action === "block" || action === "confirm";
}

function isValidRule(rule: unknown): boolean {
  const r = rule as Record<string, unknown>;
  if (typeof rule !== "object" || rule === null) return false;
  if (!isStringField(r, "pattern")) return false;
  if (!isOptionalStringField(r, "file_pattern")) return false;
  if (!isOptionalStringField(r, "includes")) return false;
  if (!isOptionalStringField(r, "excludes")) return false;
  if (!isValidScope(r.scope)) return false;
  if (!isValidAction(r.action)) return false;
  return typeof r.reason === "string";
}

export function isValidGroup(group: unknown): group is GuardrailsGroup {
  const g = group as Record<string, unknown>;
  return (
    typeof group === "object" &&
    group !== null &&
    typeof g.group === "string" &&
    typeof g.pattern === "string" &&
    (g.excludePattern === undefined || typeof g.excludePattern === "string") &&
    Array.isArray(g.rules) &&
    g.rules.every((rule: unknown) => isValidRule(rule))
  );
}
