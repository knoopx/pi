export interface DiffHunk {
  file: string;
  hunks: DiffHunkBlock[];
}

export interface DiffHunkBlock {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context" | "header" | "empty";
  content: string;
  lineNo?: number;
}

function extractFileNameFromDiffLine(line: string): string | null {
  const match = line.match(/diff --git "?(a\/)?(.+?)"?"?"?( b\/.+)?$/);
  if (!match) return null;
  const fileName = match[2]?.replace(/^a\//, "").replace(/^b\//, "");
  return fileName ?? null;
}

function parseHunkHeader(line: string): {
  removeLineNo: number;
  addLineNo: number;
} | null {
  const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) return null;
  return {
    removeLineNo: parseInt(match[1], 10),
    addLineNo: parseInt(match[3], 10),
  };
}

function isAddedLine(line: string): boolean {
  return line.startsWith("+") && !line.startsWith("+++");
}

function incrementIfNotNull(n: number | null): number | null {
  return n !== null ? n + 1 : null;
}

function parseAddedLine(
  line: string,
  addLineNo: number | null,
): { line: DiffLine; addLineNo: number | null } | null {
  if (!isAddedLine(line)) return null;
  return {
    line: {
      type: "add",
      content: line.slice(1),
      lineNo: addLineNo ?? undefined,
    },
    addLineNo: incrementIfNotNull(addLineNo),
  };
}

function isRemovedLine(line: string): boolean {
  return line.startsWith("-") && !line.startsWith("---");
}

function parseRemovedLine(
  line: string,
  removeLineNo: number | null,
): { line: DiffLine; removeLineNo: number | null } | null {
  if (!isRemovedLine(line)) return null;
  return {
    line: {
      type: "remove",
      content: line.slice(1),
      lineNo: removeLineNo ?? undefined,
    },
    removeLineNo: incrementIfNotNull(removeLineNo),
  };
}

function isContextLine(line: string): boolean {
  return line.startsWith(" ");
}

function parseContextLine(
  line: string,
  addLineNo: number | null,
  removeLineNo: number | null,
): {
  line: DiffLine;
  addLineNo: number | null;
  removeLineNo: number | null;
} | null {
  if (!isContextLine(line)) return null;
  return {
    line: {
      type: "context",
      content: line.slice(1),
      lineNo: removeLineNo ?? undefined,
    },
    addLineNo: incrementIfNotNull(addLineNo),
    removeLineNo: incrementIfNotNull(removeLineNo),
  };
}

function parseDiffLine(
  line: string,
  addLineNo: number | null,
  removeLineNo: number | null,
): {
  line: DiffLine;
  addLineNo: number | null;
  removeLineNo: number | null;
} | null {
  const added = parseAddedLine(line, addLineNo);
  if (added) return { ...added, removeLineNo };

  const removed = parseRemovedLine(line, removeLineNo);
  if (removed) return { ...removed, addLineNo };

  const context = parseContextLine(line, addLineNo, removeLineNo);
  if (context) return context;

  return parseBlankOrSkip(line, addLineNo, removeLineNo);
}

function parseBlankOrSkip(
  line: string,
  addLineNo: number | null,
  removeLineNo: number | null,
): {
  line: DiffLine;
  addLineNo: number | null;
  removeLineNo: number | null;
} | null {
  if (line === "") {
    return { line: { type: "empty", content: "" }, addLineNo, removeLineNo };
  }
  return null;
}

function isMetadataLine(line: string): boolean {
  return (
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  );
}

function handleGitLine(
  line: string,
  result: DiffHunk[],
): {
  currentFile: DiffHunk | null;
  currentHunk: DiffHunkBlock | null;
  addLineNo: number | null;
  removeLineNo: number | null;
} {
  const fileName = extractFileNameFromDiffLine(line);
  if (fileName) {
    const currentFile = { file: fileName, hunks: [] };
    result.push(currentFile);
    return {
      currentFile,
      currentHunk: null,
      addLineNo: null,
      removeLineNo: null,
    };
  }
  return {
    currentFile: null,
    currentHunk: null,
    addLineNo: null,
    removeLineNo: null,
  };
}

function handleHunkHeader(
  line: string,
  currentFile: DiffHunk | null,
): {
  currentHunk: DiffHunkBlock | null;
  addLineNo: number | null;
  removeLineNo: number | null;
} {
  const parsedHeader = parseHunkHeader(line);
  if (parsedHeader && currentFile) {
    const { removeLineNo } = parsedHeader;
    const { addLineNo } = parsedHeader;
    const currentHunk = { header: line, lines: [] };
    currentFile.hunks.push(currentHunk);
    return { currentHunk, addLineNo, removeLineNo };
  }
  return { currentHunk: null, addLineNo: null, removeLineNo: null };
}

function handleDiffLine(
  line: string,
  currentHunk: DiffHunkBlock | null,
  addLineNo: number | null,
  removeLineNo: number | null,
): { addLineNo: number | null; removeLineNo: number | null } {
  if (!currentHunk) return { addLineNo, removeLineNo };
  const parsedLine = parseDiffLine(line, addLineNo, removeLineNo);
  if (parsedLine) {
    currentHunk.lines.push(parsedLine.line);
    return {
      addLineNo: parsedLine.addLineNo,
      removeLineNo: parsedLine.removeLineNo,
    };
  }
  return { addLineNo, removeLineNo };
}

function isDiffFileLine(line: string): boolean {
  return line.startsWith("diff --git");
}

function isHunkHeaderLine(line: string): boolean {
  return line.startsWith("@@");
}

function processNonFileLine(
  line: string,
  currentFile: DiffHunk | null,
  currentHunk: DiffHunkBlock | null,
  addLineNo: number | null,
  removeLineNo: number | null,
): {
  currentHunk: DiffHunkBlock | null;
  addLineNo: number | null;
  removeLineNo: number | null;
} {
  if (isMetadataLine(line)) return { currentHunk, addLineNo, removeLineNo };
  if (isHunkHeaderLine(line)) {
    const state = handleHunkHeader(line, currentFile);
    return {
      currentHunk: state.currentHunk,
      addLineNo: state.addLineNo,
      removeLineNo: state.removeLineNo,
    };
  }
  const state = handleDiffLine(line, currentHunk, addLineNo, removeLineNo);
  return {
    currentHunk,
    addLineNo: state.addLineNo,
    removeLineNo: state.removeLineNo,
  };
}

export function parseGitDiff(diff: string): DiffHunk[] {
  const result: DiffHunk[] = [];
  const lines = diff.split("\n");
  let currentFile: DiffHunk | null = null;
  let currentHunk: DiffHunkBlock | null = null;
  let addLineNo: number | null = null;
  let removeLineNo: number | null = null;

  for (const line of lines) {
    if (isDiffFileLine(line)) {
      const state = handleGitLine(line, result);
      currentFile = state.currentFile;
      currentHunk = state.currentHunk;
      addLineNo = state.addLineNo;
      removeLineNo = state.removeLineNo;
    } else {
      const state = processNonFileLine(
        line,
        currentFile,
        currentHunk,
        addLineNo,
        removeLineNo,
      );
      currentHunk = state.currentHunk;
      addLineNo = state.addLineNo;
      removeLineNo = state.removeLineNo;
    }
  }

  return result;
}
