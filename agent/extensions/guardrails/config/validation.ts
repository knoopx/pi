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

function validateRequiredFields(r: Record<string, unknown>): boolean {
  return ["pattern", "reason"].every((key) => isStringField(r, key));
}

function validateOptionalFields(r: Record<string, unknown>): boolean {
  return ["file_pattern", "includes", "excludes"].every((key) =>
    isOptionalStringField(r, key),
  );
}

function isNullObject(rule: unknown): boolean {
  return typeof rule !== "object" || rule === null;
}

function isValidRule(rule: unknown): boolean {
  const r = rule as Record<string, unknown>;
  if (isNullObject(rule)) return false;
  if (!validateRuleFields(r)) return false;
  return isValidScope(r.scope) && isValidAction(r.action);
}

function validateRuleFields(r: Record<string, unknown>): boolean {
  return validateRequiredFields(r) && validateOptionalFields(r);
}

function isValidRulesArray(rules: unknown): boolean {
  return (
    Array.isArray(rules) && rules.every((rule: unknown) => isValidRule(rule))
  );
}

function isValidGroupFields(g: Record<string, unknown>): boolean {
  return (
    typeof g.group === "string" &&
    typeof g.pattern === "string" &&
    isOptionalStringField(g, "excludePattern")
  );
}

export function isValidGroup(group: unknown): group is GuardrailsGroup {
  const g = group as Record<string, unknown>;
  return (
    typeof group === "object" &&
    group !== null &&
    isValidGroupFields(g) &&
    isValidRulesArray(g.rules)
  );
}
