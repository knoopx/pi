import { glob } from "tinyglobby";
import type { GuardrailsRule } from "../types";
import { matchCommandPattern } from "../../../shared/matching/command";
import {
  matchContentPattern,
  matchFileNamePattern,
} from "../../../shared/matching/pattern";

async function hasMatchingFiles(
  pattern: string,
  root: string,
): Promise<boolean> {
  const matches = await glob(pattern, {
    cwd: root,
    absolute: false,
    dot: true,
    onlyDirectories: false,
  });
  return matches.length > 0;
}

export async function isGroupActive(
  pattern: string,
  root: string,
  excludePattern?: string,
): Promise<boolean> {
  try {
    if (pattern === "*") {
      if (excludePattern) {
        const excludeMatches = await glob(excludePattern, {
          cwd: root,
          absolute: false,
          dot: true,
          onlyDirectories: false,
        });
        if (excludeMatches.length > 0) return false;
      }
      return true;
    }
    if (!(await hasMatchingFiles(pattern, root))) return false;
    if (excludePattern) {
      const excludeMatches = await glob(excludePattern, {
        cwd: root,
        absolute: false,
        dot: true,
        onlyDirectories: false,
      });
      if (excludeMatches.length > 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getInputFieldAsString(
  input: unknown,
  field: string,
): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  if (value === undefined || value === null) return undefined;

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return undefined;
}

export function matchesPattern(
  context: GuardrailsRule["context"],
  targetValue: string,
  pattern: string,
): boolean {
  switch (context) {
    case "command":
      return matchCommandPattern(targetValue, pattern);
    case "file_name":
      return matchFileNamePattern(targetValue, pattern);
    case "file_content":
      return matchContentPattern(targetValue, pattern);
    default:
      return false;
  }
}

export function checkFilePatternMatch(
  filePath: string | undefined,
  filePattern: string | undefined,
): boolean {
  if (!filePattern || !filePath) return true;
  return matchFileNamePattern(filePath, filePattern);
}

function isPathWithinProject(
  filePath: string | undefined,
  projectRoot: string,
): boolean {
  if (!filePath) return true;
  const absolutePath = filePath.startsWith("/")
    ? filePath
    : `${projectRoot}/${filePath}`;
  const normalizedPath = absolutePath.replace(/\/+/g, "/");
  const normalizedRoot = projectRoot.replace(/\/+/g, "/");
  return normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function passesScopeCheck(
  rule: GuardrailsRule,
  filePath: string | undefined,
  cwd: string,
): boolean {
  if (!rule.scope) return true;
  const withinProject = isPathWithinProject(filePath, cwd);
  if (rule.scope === "project") return withinProject;
  return !withinProject;
}
