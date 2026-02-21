/**
 * Shared schemas and helpers for Linear tools
 */

import { Type } from "@sinclair/typebox";
import { errorResult } from "../../../../shared/tool-utils.js";
import { getLinearApiKey } from "../../components/linear-issues.js";

/** Shared priority parameter schema */
export const PriorityParam = Type.Optional(
  Type.Number({
    description: "Priority level (0=none, 1=urgent, 2=high, 3=normal, 4=low)",
  }),
);

/** Check API key and return error result if not logged in */
export function requireLinearAuth(): string | ReturnType<typeof errorResult> {
  const apiKey = getLinearApiKey();
  if (!apiKey) {
    return errorResult("Not logged in to Linear. Run /linear-login first.");
  }
  return apiKey;
}
