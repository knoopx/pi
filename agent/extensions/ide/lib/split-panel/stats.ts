interface FileStats {
  text: string;
  isPositive: boolean;
}
function formatNetChange(net: number): FileStats {
  const sign = net > 0 ? "+" : "-";
  return { text: `${sign} ${Math.abs(net)}`, isPositive: net > 0 };
}

export function formatFileStats(
  insertions: number | undefined,
  deletions: number | undefined,
): FileStats {
  const net = (insertions ?? 0) - (deletions ?? 0);
  if (net === 0) return { text: "", isPositive: true };
  return formatNetChange(net);
}
