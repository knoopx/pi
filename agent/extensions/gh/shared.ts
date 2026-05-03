export {
  TypeBoxFields,
  ViewParamsSchema,
  createListParamsSchema,
} from "./schema";

export {
  createErrorResult,
  pushArrayFlag,
  buildFilterArgs,
  registerListTool,
  registerViewTool,
  registerCreateTool,
} from "./tool-register";

export {
  createTextResultRender,
  createListRenderCall,
  createViewRenderCall,
} from "./rendering";

import type { Column } from "../../shared/rendering/types";
import { table } from "../../shared/rendering/table/renderer";

export function formatSearchResults<T>(
  result: { query: string; results: T[]; total: number },
  columns: Column[],
  rowMapper: (item: T, index: number) => Record<string, unknown>,
  countLabelFn: (total: number) => string,
): string {
  const rows = result.results.map(rowMapper);
  return [countLabelFn(result.total), "", table(columns, rows)].join("\n");
}
