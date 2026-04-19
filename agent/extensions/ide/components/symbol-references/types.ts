import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ListPickerItem } from "../../lib/list-picker";
import { makeCommandDef } from "./helpers";

export interface SymbolReferenceItem extends ListPickerItem {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
  callLine?: number;
}

export interface SymbolReferenceConfig {
  title: string;
  command: string;
  args: string[];
  ctx: ExtensionContext;
}

export 
interface SymbolReferenceCommandDef {
  titleFn: (target: string) => string;
  command: string;
  argsFn: (target: string) => string[];
}

export interface SymbolReferenceActionResult {
  filePath: string;
  action: SymbolReferenceActionType;
}

export type SymbolReferenceActionType =
  | "callers"
  | "callees"
  | "tests"
  | "types"
  | "schema"
  | "inspect"
  | "deps"
  | "used-by"
  | "delete";

export interface SymbolReferenceResult {
  item: SymbolReferenceItem;
  action?: SymbolReferenceActionType;
  insertType?: "name" | "path";
}


export const SYMBOL_REFERENCE_COMMANDS: Record<
  SymbolReferenceActionType,
  SymbolReferenceCommandDef
> = {
  callers: makeCommandDef("Callers of {}", "callers", (s) => [
    "callers",
    s,
    "--limit",
    "100",
  ]),
  callees: makeCommandDef("Callees of {}", "callees", (s) => [
    "callees",
    s,
    "--limit",
    "100",
  ]),
  tests: makeCommandDef("Tests for {}", "tests", (s) => ["tests", s]),
  types: makeCommandDef("Types for {}", "types", (s) => ["types", s]),
  schema: makeCommandDef("Schema for {}", "schema", (s) => ["schema", s]),
  inspect: makeCommandDef("Symbols in {}", "inspect", (f) => ["inspect", f]),
  deps: makeCommandDef("Dependencies of {}", "deps", (f) => ["deps", f]),
  "used-by": makeCommandDef("Used by {}", "deps", (f) => [
    "deps",
    f,
    "--direction",
    "used-by",
  ]),
  delete: makeCommandDef("Delete {}", "delete", (f) => ["delete", f]),
};
