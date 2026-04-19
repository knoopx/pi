import type { ListPickerItem } from "../../lib/list-picker";
import type { SymbolReferenceActionType } from "../symbol-references/types";

export interface SymbolInfo extends ListPickerItem {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface SymbolResult {
  symbol: SymbolInfo;
  action?: SymbolReferenceActionType;
  insertType?: "name" | "path";
}

// Symbol types available for filtering (cycle order)
export const SYMBOL_TYPES = [
  "class",
  "function",
  "method",
  "enum",
  "all",
] as const;

export type SymbolTypeFilter = (typeof SYMBOL_TYPES)[number];
