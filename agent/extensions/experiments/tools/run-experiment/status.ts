import type { TruncationResult } from "@earendil-works/pi-coding-agent";
import { formatNum } from "../../lib/metrics";
import type { RunDetails, ThemeFn } from "./render";
import {
  buildSuccessHeader,
  appendOutput,
  formatTruncationNote,
} from "./render";

interface BuildRunDetailsOptions {
  command: string;
  exitCode: number | null;
  durationSeconds: number;
  passed: boolean;
  timedOut: boolean;
  tailOutput: string;
  checksResult: {
    pass: boolean;
    output: string;
    timedOut: boolean;
    duration: number;
  } | null;
  parsedMetrics: Record<string, number> | null;
  parsedPrimary: number | null;
  metricName: string;
  metricUnit: string;
  llmTruncation: TruncationResult;
  fullOutputPath: string | undefined;
}

function resolveChecks(
  result: {
    pass: boolean;
    output: string;
    timedOut: boolean;
    duration: number;
  } | null,
): {
  pass: boolean | undefined;
  timedOut: boolean;
  output: string;
  duration: number;
} {
  if (!result)
    return { pass: undefined, timedOut: false, output: "", duration: 0 };
  return {
    pass: result.pass,
    timedOut: result.timedOut,
    output: result.output.split("\n").slice(-80).join("\n"),
    duration: result.duration,
  };
}

export function buildRunDetails(opts: BuildRunDetailsOptions): RunDetails {
  const checks = resolveChecks(opts.checksResult);
  return {
    command: opts.command,
    exitCode: opts.exitCode ?? undefined,
    durationSeconds: opts.durationSeconds,
    passed: opts.passed,
    crashed: !opts.passed,
    timedOut: opts.timedOut,
    tailOutput: opts.tailOutput,
    checksPass: checks.pass,
    checksTimedOut: checks.timedOut,
    checksOutput: checks.output,
    checksDuration: checks.duration,
    parsedMetrics: opts.parsedMetrics,
    parsedPrimary: opts.parsedPrimary,
    metricName: opts.metricName,
    metricUnit: opts.metricUnit,
    truncation: opts.llmTruncation.truncated
      ? (opts.llmTruncation as TruncationResult)
      : undefined,
    fullOutputPath: opts.fullOutputPath,
  };
}

function successPrefix(
  d: RunDetails,
  parsedSuffix: string,
  theme: ThemeFn,
): string {
  return (
    theme.fg("success", `󰄬 wall: ${d.durationSeconds.toFixed(1)}s`) +
    parsedSuffix
  );
}

export function getPlainText(
  content: Array<{ type?: string; text?: string }>,
): string {
  const t = content[0];
  return t?.type === "text" ? (t.text ?? "") : "";
}

function buildParsedSuffix(d: RunDetails, theme: ThemeFn): string {
  if (d.parsedPrimary === null) return "";
  return theme.fg(
    "accent",
    `, ${d.metricName}: ${formatNum(d.parsedPrimary, d.metricUnit)}`,
  );
}

function needsTruncationNote(d: RunDetails): boolean {
  return d.truncation?.truncated === true && !!d.fullOutputPath;
}

function buildStatusHeader(
  d: RunDetails,
  theme: ThemeFn,
): { text: string; outputToAppend: string | undefined } {
  const parsedSuffix = buildParsedSuffix(d, theme);
  if (d.timedOut) {
    return {
      text: theme.fg(
        "error",
        `󰥔 TIMEOUT after ${d.durationSeconds.toFixed(1)}s`,
      ),
      outputToAppend: d.tailOutput,
    };
  }
  if (d.checksTimedOut || d.checksPass === false) {
    return {
      text:
        successPrefix(d, parsedSuffix, theme) +
        theme.fg(
          "error",
          ` ${d.checksTimedOut ? "󰥔 checks timeout" : "󰚑 checks failed"} ${d.checksDuration.toFixed(1)}s`,
        ),
      outputToAppend: d.checksOutput,
    };
  }
  if (d.crashed) {
    return {
      text:
        theme.fg(
          "error",
          `󰚑 exit=${d.exitCode} ${d.durationSeconds.toFixed(1)}s`,
        ) + parsedSuffix,
      outputToAppend: d.tailOutput,
    };
  }
  return { text: buildSuccessHeader(d, theme), outputToAppend: d.tailOutput };
}

export function formatResultText(
  d: RunDetails,
  expanded: boolean,
  theme: ThemeFn,
): string {
  const { text: headerText, outputToAppend } = buildStatusHeader(d, theme);
  let text = appendOutput(headerText, outputToAppend, expanded, 5, theme);

  if (needsTruncationNote(d)) {
    text += "\n" + formatTruncationNote(d, theme);
  }

  return text;
}
