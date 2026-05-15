// Shared output-formatting helpers for ShellSession. Mirrors
// local/tools/shell_session.py's _strip_ansi / _dedup_lines / _truncate_lines
// so output reaches the model in the same format across backends.

const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const MAX_LINES = 200;
export const DEFAULT_TIMEOUT = 30;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

export function dedupLines(lines: string[]): string[] {
  const out: string[] = [];
  let last: string | null = null;
  let dup = 0;
  for (const ln of lines) {
    if (ln === last) {
      dup++;
      continue;
    }
    if (dup > 0) out.push(`  [... ${dup} duplicate line(s) collapsed ...]`);
    dup = 0;
    out.push(ln);
    last = ln;
  }
  if (dup > 0) out.push(`  [... ${dup} duplicate line(s) collapsed ...]`);
  return out;
}

export function truncateLines(lines: string[], cap = MAX_LINES): { lines: string[]; truncated: boolean } {
  if (lines.length <= cap) return { lines, truncated: false };
  const head = Math.floor(cap / 2);
  const tail = Math.floor(cap / 4);
  const skipped = lines.length - head - tail;
  return {
    lines: [...lines.slice(0, head), `  [... ${skipped} lines truncated ...]`, ...lines.slice(-tail)],
    truncated: true,
  };
}

export function formatOutput(
  raw: string,
  code: number,
  cwd: string,
  timedOut: boolean,
  backendNote: string,
): string {
  const cleaned = stripAnsi(raw).replace(/\r/g, "");
  const dedupped = dedupLines(cleaned.split("\n"));
  const { lines, truncated } = truncateLines(dedupped);
  const body = lines.join("\n");
  const footerBits = [`exit=${code}`, `cwd=${cwd}`, `timed_out=${timedOut ? "true" : "false"}`];
  if (truncated) footerBits.push("output_truncated=true");
  if (backendNote) footerBits.push(backendNote);
  const footer = `[${footerBits.join(" ")}]`;
  return body ? `${body}\n${footer}` : footer;
}
