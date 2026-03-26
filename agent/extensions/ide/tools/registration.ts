/**
 * Tools Registration
 *
 * Imports and registers all tools from their respective modules.
 */

import {
  registerProjectStats,
  registerProjectMap,
  registerSearchSymbols,
  registerInspectFile,
  registerAnalyzeDependencies,
  registerSymbolDiff,
  registerFindCallers,
  registerFindCallees,
  registerFindTests,
  registerFindUntested,
  registerApiChanges,
  registerFindEntrypoints,
  registerTraceCallPath,
  registerImpactAnalysis,
  registerTestDependencies,
  registerSymbolBlame,
  registerSymbolHistory,
  registerFindImplementations,
  registerAnalyzeTypes,
  registerShowSchema,
  registerSaveSnapshot,
  registerCompareSnapshot,
} from "./cm-tools/index.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function registerAllTools(pi: ExtensionAPI): void {
  // Register code analysis tools
  registerProjectStats(pi);
  registerProjectMap(pi);
  registerSearchSymbols(pi);
  registerInspectFile(pi);
  registerAnalyzeDependencies(pi);
  registerSymbolDiff(pi);
  registerFindCallers(pi);
  registerFindCallees(pi);
  registerFindTests(pi);
  registerFindUntested(pi);
  registerApiChanges(pi);
  registerFindEntrypoints(pi);
  registerTraceCallPath(pi);
  registerImpactAnalysis(pi);
  registerTestDependencies(pi);
  registerSymbolBlame(pi);
  registerSymbolHistory(pi);
  registerFindImplementations(pi);
  registerAnalyzeTypes(pi);
  registerShowSchema(pi);
  registerSaveSnapshot(pi);
  registerCompareSnapshot(pi);
}
