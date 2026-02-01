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
 * Returns true if !pi is found, false if pi but not !pi, null if no pi.
 */
export function lineHasTrigger(line: string): boolean | null {
  if (typeof line !== "string") {
    return null;
  }

  const trimmedLine = line.trim();

  // Check if line has pi
  if (!/pi\b/i.test(trimmedLine)) {
    return null;
  }

  // Return true if !pi is found, false if pi but not !pi
  return /!pi\b/i.test(trimmedLine);
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
 * Groups consecutive lines that have !pi triggers.
 */
export function parsePIReferencesInFile(
  filePath: string,
  content: string,
): TriggerReference[] {
  if (typeof content !== "string") {
    return [];
  }

  const lines = content.split("\n");
  const references: TriggerReference[] = [];
  let currentGroup: string[] = [];
  let currentLineNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasTrigger = lineHasTrigger(line);

    if (hasTrigger === true) {
      // Start or continue a group
      if (currentGroup.length === 0) {
        currentLineNumber = i + 1;
      }
      currentGroup.push(line);
    } else {
      // End current group if it exists
      if (currentGroup.length > 0) {
        references.push({
          filePath,
          lineNumber: currentLineNumber,
          rawLines: [...currentGroup],
          hasTrigger: true,
        });
        currentGroup = [];
      }
    }
  }

  // Add final group if exists
  if (currentGroup.length > 0) {
    references.push({
      filePath,
      lineNumber: currentLineNumber,
      rawLines: [...currentGroup],
      hasTrigger: true,
    });
  }

  return references;
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

  let message = "The PI comments below can be found in the code files.\n";
  message += "They contain your instructions.\n";
  message += "Line numbers are provided for reference.\n";
  message += "Rules:\n";
  message += "- Only make changes to files and lines that have PI comments.\n";
  message += "- Do not modify unknown other files or areas of files.\n";
  message += "- Follow the instructions in the PI comments strictly.\n";
  message +=
    "- Be sure to remove all PI comments from the code during or after the changes.\n";
  message +=
    '- After changes are finished say just "Done" and nothing else.\n\n';

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
