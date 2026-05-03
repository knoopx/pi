const W = 20;

function clearLine() {
  process.stderr.write("\r\x1b[2K\r");
}

export interface ProgressState {
  message: string | null;
}

export function renderEmbedding(
  state: ProgressState,
  done: number,
  total: number,
): void {
  const f = Math.round((W * done) / total);
  const pct = `${Math.round((done / total) * 100)}%`;
  const msg = state.message ? ` ${state.message}` : "";
  process.stderr.write(`\r[${"█".repeat(f)}${"░".repeat(W - f)}] ${pct}${msg}`);
}

export function finishEmbedding(): void {
  clearLine();
  process.stderr.write("\r\n");
}
