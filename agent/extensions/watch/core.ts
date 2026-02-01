/**
 * Core utilities for the watch extension.
 * Separated for testability.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { TriggerReference } from "./types";

export const DEFAULT_IGNORED_PATTERNS = [
  /\.git/,
  /node_modules/,
  /dist/,
  /build/,
  /\.pi\/agent\/sessions/,
];

/**
 * Check if a line contains a PI trigger.
 * Returns the hasTrigger flag.
 */
export function lineHasTrigger(line: string): boolean | null {
  if (typeof line !== "string") {
    return null;
  }

  // Check the entire line for !pi anywhere (case insensitive)
  const trimmedLine = line.trim();

  // Look for !pi patterns (case insensitive)
  const hasBangPi = /!pi\b/i.test(trimmedLine);

  if (!hasBangPi) {
    return null;
  }

  // Return true if !pi is found
  return true;
}

/**
 * Check if a line contains any PI reference (with or without trigger).
 */
export function lineHasPI(line: string): boolean {
  if (typeof line !== "string") {
    return false;
  }

  // Check the entire line for pi anywhere (case insensitive)
  const trimmedLine = line.trim();

  // Look for pi patterns (case insensitive)
  return /pi\b/i.test(trimmedLine);
}

/**
 * Check if a path should be ignored based on ignore patterns.
 */
export function shouldIgnorePath(
  filePath: string,
  ignoredPatterns: RegExp[],
): boolean {
  return ignoredPatterns.some((pattern) => pattern.test(filePath));
}

/**
 * Find all PI references in file content.
 * When a trigger (!PI) is found, collects all PI references from the file.
 */
export function parsePIReferencesInFile(
  filePath: string,
  content: string,
): TriggerReference[] {
  if (typeof content !== "string") {
    return [];
  }

  const lines = content.split("\n");
  const piLines: Array<{
    lineNumber: number;
    line: string;
    hasTrigger: boolean;
  }> = [];

  // First pass: collect all PI lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (lineHasPI(line)) {
      piLines.push({
        lineNumber: i + 1,
        line,
        hasTrigger: !!lineHasTrigger(line),
      });
    }
  }

  // If no PI lines found, return empty
  if (piLines.length === 0) {
    return [];
  }

  // Check if any PI line has a trigger
  const hasAnyTrigger = piLines.some((pi) => pi.hasTrigger);

  // If there's a trigger, return all PI lines as one group
  if (hasAnyTrigger) {
    return [
      {
        filePath,
        lineNumber: Math.min(...piLines.map((pi) => pi.lineNumber)),
        rawLines: piLines.map((pi) => pi.line),
        hasTrigger: true,
      },
    ];
  }

  // No trigger found, return empty (no action needed)
  return [];
}

/**
 * Read a file and parse PI references.
 */
export function readFileAndParsePIReferences(filePath: string): {
  content: string;
  references: TriggerReference[];
} | null {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const content = typeof fileContent === "string" ? fileContent : "";
    const references = parsePIReferencesInFile(filePath, content);
    return { content, references };
  } catch {
    return null;
  }
}

/**
 * Get relative path from cwd.
 */
function getRelativePath(filePath: string, cwd: string): string {
  return path.relative(cwd, filePath);
}

/**
 * Check if PI references array has a trigger (always true for returned references).
 */
export function hasTrigger(references: TriggerReference[]): boolean {
  return references.some((r) => r.hasTrigger);
}

/**
 * Create the user message for the agent.
 */
export function createMessage(references: TriggerReference[]): string {
  if (references.length === 0) {
    return "";
  }

  let message = "The !pi references below can be found in the code files.\n";
  message += "They contain your instructions.\n";
  message += "Line numbers are provided for reference.\n";
  message += "Rules:\n";
  message +=
    "- Only make changes to files and lines that have !pi references.\n";
  message += "- Do not modify unknown other files or areas of files.\n";
  message += "- Follow the instructions in the !pi references strictly.\n";
  message +=
    "- Be sure to remove all !pi references from the code during or after the changes.\n";
  message +=
    '- After changes are finised say just "Done" and nothing else.\n\n';

  for (const reference of references) {
    const relativePath = getRelativePath(reference.filePath, process.cwd());
    message += `${relativePath}:\n`;
    for (let i = 0; i < reference.rawLines.length; i++) {
      const lineNumber = reference.lineNumber + i;
      message += `${lineNumber}: ${reference.rawLines[i]}\n`;
    }
    message += "\n";
  }

  return message.trim();
}
