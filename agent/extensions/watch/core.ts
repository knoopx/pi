/**
 * Core utilities for the watch extension.
 * Separated for testability.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ParsedComment } from "./types";

export const DEFAULT_IGNORED_PATTERNS = [
  /\.git/,
  /node_modules/,
  /dist/,
  /build/,
  /\.pi/,
];

// Comment styles: #, //, --
// Position: start OR end of line
// Case insensitive
// Variants: !PI, PI (with or without punctuation)
const COMMENT_PATTERNS = [
  // PI at end: // do this !pi, # implement this PI, // text PI:
  /^(?:#|\/\/|--)\s*(.+?)\s*(?:!pi|pi)\s*[:\s]*$/i,
  // PI at start: // !pi do this, # PI implement this, // PI: do this
  /^(?:#|\/\/|--)\s*(?:!pi|pi)[:\s]*\s*(.+)$/i,
];

/**
 * Check if a line contains an AI comment.
 * Returns the hasTrigger flag.
 */
function parseAIComment(line: string): boolean | null {
  const trimmedLine = line.trim();

  for (const pattern of COMMENT_PATTERNS) {
    if (pattern.test(trimmedLine)) {
      return trimmedLine.toLowerCase().includes("!pi");
    }
  }
  return null;
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
 * Find all AI comments in file content with grouping.
 * Consecutive AI comment lines are grouped together.
 */
function parseCommentsInFile(
  filePath: string,
  content: string,
): ParsedComment[] {
  const lines = content.split("\n");
  const comments: ParsedComment[] = [];
  let currentGroup: string[] = [];
  let groupStartLine = 0;
  let groupHasTrigger = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasTrigger = parseAIComment(line);

    if (hasTrigger !== null) {
      if (currentGroup.length === 0) {
        groupStartLine = i + 1;
      }
      currentGroup.push(line); // Store raw line with whitespace preserved
      if (hasTrigger) {
        groupHasTrigger = true;
      }
    } else {
      // End of group
      if (currentGroup.length > 0) {
        comments.push({
          filePath,
          lineNumber: groupStartLine,
          rawLines: [...currentGroup],
          hasTrigger: groupHasTrigger,
        });
        currentGroup = [];
        groupHasTrigger = false;
      }
    }
  }

  // Handle group at end of file
  if (currentGroup.length > 0) {
    comments.push({
      filePath,
      lineNumber: groupStartLine,
      rawLines: [...currentGroup],
      hasTrigger: groupHasTrigger,
    });
  }

  return comments;
}

/**
 * Read a file and parse AI comments.
 */
export function readFileAndParseComments(filePath: string): {
  content: string;
  comments: ParsedComment[];
} | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const comments = parseCommentsInFile(filePath, content);
    return { content, comments };
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
 * Check if unknown comment in the array has a trigger.
 */
export function hasTriggerComment(comments: ParsedComment[]): boolean {
  return comments.some((c) => c.hasTrigger);
}

/**
 * Create the user message for the PI agent.
 */
export function createMessage(comments: ParsedComment[]): string {
  if (comments.length === 0) {
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
    '- After changes are finised say just "Done" and nothing else.\n\n';

  for (const comment of comments) {
    const relativePath = getRelativePath(comment.filePath, process.cwd());
    message += `${relativePath}:\n`;
    for (let i = 0; i < comment.rawLines.length; i++) {
      const lineNumber = comment.lineNumber + i;
      message += `${lineNumber}: ${comment.rawLines[i]}\n`;
    }
    message += "\n";
  }

  return message.trim();
}
