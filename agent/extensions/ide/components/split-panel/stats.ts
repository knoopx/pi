/** Format file line stats as signed net change string. */
export interface FileStats {
  text: string;
  isPositive: boolean;
}

export function formatFileStats(
  insertions: number | undefined,
  deletions: number | undefined,
): FileStats {
  const ins = insertions ?? 0;
  const del = deletions ?? 0;
  const net = ins - del;
  if (net === 0) return { text: "", isPositive: true };
  const sign = net > 0 ? "+" : "-";
  return { text: `${sign} ${Math.abs(net)}`, isPositive: net > 0 };
}
