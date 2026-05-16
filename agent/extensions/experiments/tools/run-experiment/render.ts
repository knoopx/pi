import type { TruncationResult } from "@earendil-works/pi-coding-agent";
import { formatSize } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { formatNum } from "../../lib/metrics";

const EXPERIMENT_MAX_BYTES = 4 * 1024;

export interface PartialRunDetails {
  phase?: string;
  elapsed?: string;
  truncation?: TruncationResult;
  fullOutputPath?: string;
}

export interface RunDetails {
  phase?: string;
  elapsed?: string;
  truncation?: TruncationResult;
  fullOutputPath?: string;
  durationSeconds: number;
  parsedPrimary: number | null;
  metricName: string;
  metricUnit: string;
  checksPass?: boolean;
  checksDuration: number;
  timedOut?: boolean;
  tailOutput?: string;
  checksTimedOut?: boolean;
  checksOutput?: string;
  crashed?: boolean;
  exitCode?: number;
}

export interface ThemeFn {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

export function renderPartialResult(
  result: {
    content: Array<{ type: string; text?: string }>;
    details?: PartialRunDetails;
  },
  expanded: boolean,
  previewLines: number,
  theme: ThemeFn,
): Text {
  const d = result.details;
  const elapsed = d?.elapsed ?? "";
  const outputText =
    result.content[0]?.type === "text" ? result.content[0].text : "";

  let text = theme.fg("warning", `⏳ Running${elapsed ? ` ${elapsed}` : ""}…`);

  if (outputText) {
    const lines = outputText.split("\n");
    const maxLines = expanded ? 20 : previewLines;
    const tail = lines.slice(-maxLines).join("\n");
    if (tail.trim()) {
      text += "\n" + theme.fg("dim", tail);
    }
  }

  return new Text(text, 0, 0);
}

export function buildSuccessHeader(d: RunDetails, theme: ThemeFn): string {
  let text = theme.fg("success", "✅ ");
  const parts: string[] = [`wall: ${d.durationSeconds.toFixed(1)}s`];
  if (d.parsedPrimary !== null) {
    parts.push(`${d.metricName}: ${formatNum(d.parsedPrimary, d.metricUnit)}`);
  }
  text += theme.fg("accent", parts.join(", "));

  if (d.checksPass === true) {
    text += theme.fg("success", ` ✓ checks ${d.checksDuration.toFixed(1)}s`);
  }

  if (d.truncation?.truncated && d.fullOutputPath) {
    text += theme.fg("warning", " (truncated)");
  }

  return text;
}

export function appendOutput(
  text: string,
  output: string | undefined,
  expanded: boolean,
  previewLines: number,
  theme: ThemeFn,
): string {
  if (!output) return text;
  const lines = output.split("\n");
  if (expanded) {
    return text + "\n" + theme.fg("dim", output.slice(-2000));
  }
  const tail = lines.slice(-previewLines).join("\n");
  if (!tail.trim()) return text;
  const hidden = lines.length - previewLines;
  let result = text;
  if (hidden > 0) {
    result += "\n" + theme.fg("muted", `… ${hidden} more lines`);
  }
  return result + "\n" + theme.fg("dim", tail);
}

export function formatTruncationNote(d: RunDetails, theme: ThemeFn): string {
  const trunc = d.truncation;
  if (!trunc) return "";
  if (trunc.truncatedBy === "lines") {
    return theme.fg(
      "warning",
      `[Truncated: showing ${trunc.outputLines} of ${trunc.totalLines} lines. Full output: ${d.fullOutputPath}]`,
    );
  }
  return theme.fg(
    "warning",
    `[Truncated: ${trunc.outputLines} lines shown (${formatSize(EXPERIMENT_MAX_BYTES)} limit). Full output: ${d.fullOutputPath}]`,
  );
}
