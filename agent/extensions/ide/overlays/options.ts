/**
 * Shared constants and types for overlay components.
 */

import type { CmActionType } from "../components/cm-results";

export const FULL_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "95%" as const,
    anchor: "center" as const,
  },
};

export const CENTERED_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "70%" as const,
    minWidth: 60,
    anchor: "center" as const,
  },
};

export interface CmActionResult {
  filePath: string;
  action: CmActionType;
}
