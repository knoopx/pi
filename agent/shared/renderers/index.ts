/**
 * Renderers extension — structured output helpers.
 *
 * Exports:
 *   dotJoin          - join segments with ` • `
 *   sectionDivider   - ─── Label ─────────────────
 *   threadSeparator  - ── author • date ───────────
 *   stateDot         - ● / ○ state indicator
 *   table            - columnar list
 *   Column           - column type (from ./types)
 *   detail           - key-value pairs
 *   actionLine       - one-line confirmation
 */

export { dotJoin, stateDot, countLabel } from "./header";
export { table } from "./table/renderer";
export { type Column } from "./types";
export { detail } from "./detail";
