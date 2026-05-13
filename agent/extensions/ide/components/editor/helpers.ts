function skipCharsBackward(
  line: string,
  from: number,
  pattern: RegExp,
): number {
  let pos = from;
  while (pos > 0 && pattern.test(line[pos - 1])) pos--;
  return pos;
}

function skipCharsForward(
  line: string,
  from: number,
  maxPos: number,
  pattern: RegExp,
): number {
  let pos = from;
  while (pos < maxPos && pattern.test(line[pos])) pos++;
  return pos;
}

export function findWordBoundaryBackward(
  line: string,
  startCol: number,
): number {
  let pos = skipCharsBackward(line, startCol, /\s/);
  pos = skipCharsBackward(line, pos, /\w/);
  return pos;
}

export function findWordBoundaryForward(
  line: string,
  startCol: number,
  lineLen: number,
): number {
  let pos = skipCharsForward(line, startCol, lineLen, /\w/);
  pos = skipCharsForward(line, pos, lineLen, /\s/);
  return pos;
}

export function clampCol(
  lines: string[],
  cursor: { line: number; col: number },
): void {
  const maxCol = (lines[cursor.line] ?? "").length;
  if (cursor.col > maxCol) {
    cursor.col = maxCol;
  }
}

export function getLeadingWhitespace(text: string): string {
  return text.match(/^\s*/)?.[0] ?? "";
}
