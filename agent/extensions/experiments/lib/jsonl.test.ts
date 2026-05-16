import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "vitest";

import { appendHookLogEntryIfConfigured, type HookResult } from "./hooks";
import {
  extractExperimentSessionName,
  hasExperimentConfigHeader,
  isExperimentConfigEntry,
  isExperimentRunEntry,
  parseJsonlEntry,
  reconstructJsonlState,
} from "./jsonl";

test("hook entries are skipped when identifying run entries", () => {
  const hookEntry = parseJsonlEntry(
    '{"type":"hook","stage":"before","exit_code":0}',
  );
  const runEntry = parseJsonlEntry('{"run":1,"metric":42}');

  expect(isExperimentConfigEntry(hookEntry)).toBe(false);
  expect(isExperimentRunEntry(hookEntry)).toBe(false);
  expect(isExperimentRunEntry(runEntry)).toBe(true);
});

test("hook-only jsonl does not count as having a config header", () => {
  const jsonl = '{"type":"hook","stage":"before","exit_code":0}\n';

  expect(hasExperimentConfigHeader(jsonl)).toBe(false);
});

test("session name comes from the first config entry, not the first line", () => {
  const jsonl = [
    '{"type":"hook","stage":"before","exit_code":0}',
    '{"type":"config","name":"Hook-safe session","metricName":"total_ms","metricUnit":"ms","bestDirection":"lower"}',
    '{"run":1,"commit":"abc1234","metric":10,"status":"keep","description":"baseline","timestamp":1,"metrics":{}}',
  ].join("\n");

  expect(hasExperimentConfigHeader(jsonl)).toBe(true);
  expect(extractExperimentSessionName(jsonl)).toBe("Hook-safe session");
});

test("reconstructJsonlState ignores hooks and preserves run segments", () => {
  const jsonl = [
    '{"type":"config","name":"Segmented session","metricName":"total_ms","metricUnit":"ms","bestDirection":"lower"}',
    '{"type":"hook","stage":"before","exit_code":0}',
    '{"run":1,"commit":"aaa1111","metric":10,"status":"keep","description":"baseline","timestamp":1,"metrics":{"compile_ms":4}}',
    '{"type":"hook","stage":"after","exit_code":0}',
    '{"type":"config","name":"Segmented session","metricName":"total_ms","metricUnit":"ms","bestDirection":"lower"}',
    '{"type":"hook","stage":"before","exit_code":0}',
    '{"run":2,"commit":"bbb2222","metric":7,"status":"keep","description":"new baseline","timestamp":2,"metrics":{"render_ms":2}}',
  ].join("\n");

  const state = reconstructJsonlState(jsonl);

  expect(state.results.length).toBe(2);
  expect(state.results.map((result) => result.metric)).toEqual([10, 7]);
  expect(state.results.map((result) => result.segment)).toEqual([0, 1]);
  expect(state.currentSegment).toBe(1);
  expect(state.secondaryMetrics.map((metric) => metric.name)).toEqual([
    "render_ms",
  ]);
});

test("hook observability does not create jsonl before config exists", () => {
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), "pi-experiment-hooks-"));
  const jsonlPath = path.join(tempDir, "experiment.jsonl");
  const result: HookResult = {
    fired: true,
    stdout: "",
    stderr: "",
    exitCode: 0,
    timedOut: false,
    durationMs: 5,
  };

  try {
    expect(appendHookLogEntryIfConfigured(jsonlPath, "before", result)).toBe(
      false,
    );
    expect(fs.existsSync(jsonlPath)).toBe(false);

    fs.writeFileSync(
      jsonlPath,
      '{"type":"hook","stage":"before","exit_code":0}\n',
    );
    expect(appendHookLogEntryIfConfigured(jsonlPath, "after", result)).toBe(
      false,
    );
    expect(fs.readFileSync(jsonlPath, "utf-8")).toBe(
      '{"type":"hook","stage":"before","exit_code":0}\n',
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
