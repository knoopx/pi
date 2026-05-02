export function actionLine(action: string, detail?: string): string {
  const parts = [action];
  if (detail) parts.push(detail);
  return parts.join(" • ");
}
