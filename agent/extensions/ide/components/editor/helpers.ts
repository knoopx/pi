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

function getCharType(char: string): "word" | "punct" | "space" | "none" {
  if (!char) return "none";
  if (/\s/.test(char)) return "space";
  if (/\w/.test(char)) return "word";
  return "punct";
}

function isWhitespace(line: string, index: number): boolean {
  if (index < 0 || index >= line.length) return false;
  return /\s/.test(line[index] ?? "");
}

function skipWhitespaceBackward(line: string, from: number): number {
  let pos = from;
  while (pos > 0 && isWhitespace(line, pos - 1)) pos--;
  return pos + 1;
}

function skipWhitespaceForward(line: string, from: number): number {
  let pos = from;
  while (pos < line.length && isWhitespace(line, pos)) pos++;
  return pos;
}

function skipNonWord(line: string, from: number, backward: boolean): number {
  return backward
    ? skipWhitespaceBackward(line, from)
    : skipWhitespaceForward(line, from);
}

function skipSameBackward(
  line: string,
  from: number,
  charType: "word" | "punct" | "space" | "none",
): number {
  let pos = from;
  while (pos > 0 && getCharType(line[pos - 1] ?? "") === charType) pos--;
  return pos + 1;
}

function skipSameForward(
  line: string,
  from: number,
  charType: "word" | "punct" | "space" | "none",
): number {
  let pos = from;
  while (pos < line.length && getCharType(line[pos] ?? "") === charType) pos++;
  return pos;
}

function skipSameType(
  line: string,
  from: number,
  charType: "word" | "punct" | "space" | "none",
  backward: boolean,
): number {
  return backward
    ? skipSameBackward(line, from, charType)
    : skipSameForward(line, from, charType);
}

function moveToNextWordBoundary(line: string, fromCol: number): number {
  const charType = getCharType(line[fromCol] ?? "");
  return skipSameType(line, fromCol, charType, false);
}

export function moveWordLeftOnLine(
  lines: string[],
  cursor: { line: number; col: number },
): void {
  const line = lines[cursor.line] ?? "";
  if (cursor.col === 0) return;

  let col = cursor.col - 1;
  col = skipNonWord(line, col, true);
  const charType = getCharType(line[col] ?? "");
  col = skipSameType(line, col, charType, true);
  cursor.col = col;
}

export function moveWordRightOnLine(
  lines: string[],
  cursor: { line: number; col: number },
): void {
  const line = lines[cursor.line] ?? "";

  if (cursor.col >= line.length) return;

  let col = skipNonWord(line, cursor.col, false);
  if (col < line.length) {
    col = moveToNextWordBoundary(line, col);
  }
  cursor.col = col;
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
