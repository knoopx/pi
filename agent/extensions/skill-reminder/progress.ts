const W = 20;

function clearLine() {
  // \r + CSI 2K clears entire current line, then \r returns to column 0
  process.stderr.write("\r\x1b[2K\r");
}

export function renderEmbedding(done: number, total: number) {
  clearLine();
  const f = Math.round((W * done) / total);
  const pct = `${Math.round((done / total) * 100)}%`;
  process.stderr.write(`[${"█".repeat(f)}${"░".repeat(W - f)}] ${pct}`);
}

export function finish() {
  clearLine();
  process.stderr.write("\r\n");
}
