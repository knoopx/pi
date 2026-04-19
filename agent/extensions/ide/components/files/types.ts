import type { ListPickerItem } from "../../lib/list-picker";
import type { SymbolReferenceActionType } from "../symbol-references/types";

export interface FileInfo extends ListPickerItem {
  path: string;
}

export interface FileResult {
  file: FileInfo;
  action?: SymbolReferenceActionType;
}
