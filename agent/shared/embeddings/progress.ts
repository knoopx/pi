const W = 20;

let enabled = true;

function clearLine() {
  process.stderr.write("\r\x1b[2K\r");
}

export function renderEmbedding(done: number, total: number): void {
  if (!enabled) return;
  const f = Math.round((W * done) / total);
  const pct = `${Math.round((done / total) * 100)}%`;
  process.stderr.write(`\r[${"█".repeat(f)}${"░".repeat(W - f)}] ${pct}`);
}

export function finishEmbedding(): void {
  if (!enabled) return;
  clearLine();
  process.stderr.write("\r\n");
}
