/**
 * Action Confirmation — one-line result with state transition.
 *
 * Examples:
 *   actionLine("Toggled light.living_room", "● on → ● off")
 *   actionLine('Added task "Review PR #142"', "due 2026-03-07")
 */

/**
 * Render a one-line action confirmation.
 *
 * @param action  Primary action description
 * @param detail  Optional detail (state transition, metadata)
 */
export function actionLine(action: string, detail?: string): string {
  const parts = [action];
  if (detail) parts.push(detail);
  return parts.join(" • ");
}
