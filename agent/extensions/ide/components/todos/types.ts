import type { ListPickerItem } from "../../lib/list-picker";

export interface AstGrepMatch {
  file: string;
  text: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export interface TodoItem extends ListPickerItem {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  tag: string;
}
