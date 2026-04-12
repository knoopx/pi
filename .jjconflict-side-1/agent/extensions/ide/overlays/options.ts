/**
 * Shared constants and types for overlay components.
 */

import type { SymbolReferenceActionType } from "../components/symbol-references";

export const FULL_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "95%" as const,
    anchor: "center" as const,
  },
};

export interface SymbolReferenceActionResult {
  filePath: string;
  action: SymbolReferenceActionType;
}
