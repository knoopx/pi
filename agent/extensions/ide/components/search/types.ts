export interface SearchResult {
  id: string;
  label: string;
  path: string;
  lineNum: number;
  colNum: number;
  lineText: string;
  matchedText: string;
  startLine?: number;
  endLine?: number;
}
