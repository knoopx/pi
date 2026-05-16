import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "vitest";

import {
  experimentSummaryPathsFor,
  buildExperimentCompactionSummary,
} from "./compaction";

function withTempWorkDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(tmpdir(), "pi-experiment-compact-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeJsonlLines(workDir: string, lines: string[]): void {
  fs.writeFileSync(
    path.join(workDir, "experiment.jsonl"),
    lines.join("\n") + "\n",
  );
}

function assertMatch(summary: string, ...patterns: RegExp[]): void {
  for (const pattern of patterns) {
    expect(summary).toMatch(pattern);
  }
}

function assertNoMatch(summary: string, ...patterns: RegExp[]): void {
  for (const pattern of patterns) {
    expect(summary).not.toMatch(pattern);
  }
}

function withSummary(
  lines: string[],
  assertFn: (summary: string) => void,
): void {
  withTempWorkDir((workDir) => {
    writeJsonlLines(workDir, lines);
    assertFn(
      buildExperimentCompactionSummary(experimentSummaryPathsFor(workDir)),
    );
  });
}

test("summary contains all persisted sources when present", () => {
  withTempWorkDir((workDir) => {
    fs.writeFileSync(
      path.join(workDir, "experiment.md"),
      "# Rules\nDo not cheat.",
    );
    fs.writeFileSync(
      path.join(workDir, "experiment.ideas.md"),
      "- Try memoization\n- Try parallelism",
    );
    writeJsonlLines(workDir, [
      '{"type":"config","name":"Speed up parser","metricName":"total_us","metricUnit":"us","bestDirection":"lower"}',
      '{"run":1,"commit":"aaa1111","metric":100,"status":"keep","description":"baseline","timestamp":1,"metrics":{},"asi":{"hypothesis":"start point"}}',
      '{"run":2,"commit":"bbb2222","metric":80,"status":"keep","description":"cache foo","timestamp":2,"metrics":{},"asi":{"hypothesis":"memoize repeated keys","next_action_hint":"try LRU"}}',
      '{"run":3,"commit":"ccc3333","metric":120,"status":"discard","description":"tried lru-cache","timestamp":3,"metrics":{},"asi":{"rollback_reason":"import overhead"}}',
    ]);

    const summary = buildExperimentCompactionSummary(
      experimentSummaryPathsFor(workDir),
    );

    assertMatch(
      summary,
      /# Experiment Compaction Summary/,
      /## Session/,
      /Goal: Speed up parser/,
      /Metric: total_us — lower is better/,
      /Runs so far: 3 \(2 keep · 1 discard\)/,
      /Baseline \(#1\): 100us/,
      /Best\s+\(#2\): 80us \(-20\.0%\)/,
      /## Experiment Rules \(experiment\.md\)/,
      /Do not cheat\./,
      /## Ideas Backlog \(experiment\.ideas\.md\)/,
      /Try memoization/,
      /## Recent Runs \(last 3\)/,
      /#1 keep/,
      /#2 keep\s+80 \(-20\.0%\)/,
      /#3 discard\s+120 \(\+20\.0%\)/,
      /hyp: memoize repeated keys/,
      /next: try LRU/,
      /rollback: import overhead/,
      /## Next Step/,
      /If you need more details, read additional lines from experiment\.jsonl\./,
    );
  });
});

test("session block omits baseline/best when no runs exist yet", () => {
  withSummary(
    [
      '{"type":"config","name":"Cold start","metricName":"ms","metricUnit":"ms","bestDirection":"lower"}',
    ],
    (summary) => {
      assertMatch(summary, /Goal: Cold start/, /Runs so far: 0/);
      assertNoMatch(summary, /Baseline/, /Best\s+\(#/);
    },
  );
});

test("session block reflects current segment after re-init", () => {
  withSummary(
    [
      '{"type":"config","name":"Old goal","metricName":"ms","metricUnit":"ms","bestDirection":"lower"}',
      '{"run":1,"commit":"a","metric":500,"status":"keep","description":"old baseline","timestamp":1,"metrics":{}}',
      '{"type":"config","name":"New goal","metricName":"bytes","metricUnit":"kb","bestDirection":"higher"}',
      '{"run":2,"commit":"b","metric":10,"status":"keep","description":"new baseline","timestamp":2,"metrics":{}}',
      '{"run":3,"commit":"c","metric":15,"status":"keep","description":"better","timestamp":3,"metrics":{}}',
    ],
    (summary) => {
      assertMatch(
        summary,
        /Goal: New goal/,
        /Metric: bytes — higher is better/,
        /Runs so far: 2 \(2 keep\)/,
        /Baseline \(#2\): 10kb/,
        /Best\s+\(#3\): 15kb \(\+50\.0%\)/,
      );
    },
  );
});

test("summary degrades gracefully when no files exist", () => {
  withSummary([], (summary) => {
    assertMatch(
      summary,
      /# Experiment Compaction Summary/,
      /## Session/,
      /Goal: —/,
      /Runs so far: 0/,
      /No runs yet/,
      /## Next Step/,
    );
    assertNoMatch(summary, /## Experiment Rules/, /## Ideas Backlog/);
  });
});

test("summary keeps only the last 50 runs", () => {
  const lines = [
    '{"type":"config","name":"S","metricName":"ms","metricUnit":"ms","bestDirection":"lower"}',
  ];
  for (let i = 1; i <= 75; i++) {
    lines.push(
      `{"run":${i},"commit":"c${i}","metric":${100 + i},"status":"keep","description":"r${i}","timestamp":${i},"metrics":{}}`,
    );
  }
  withSummary(lines, (summary) => {
    assertMatch(summary, /## Recent Runs \(last 50\)/, /#26 keep/, /#75 keep/);
    assertNoMatch(summary, /#25 keep/);
  });
});

test("recent run deltas use the full segment baseline even when baseline is hidden", () => {
  const lines = [
    '{"type":"config","name":"S","metricName":"ms","metricUnit":"ms","bestDirection":"lower"}',
  ];
  for (let i = 1; i <= 75; i++) {
    lines.push(
      `{"run":${i},"commit":"c${i}","metric":${100 - i},"status":"keep","description":"r${i}","timestamp":${i},"metrics":{}}`,
    );
  }
  withSummary(lines, (summary) => {
    assertMatch(
      summary,
      /#51 keep\s+49 \(-50\.5%\)/,
      /#75 keep\s+25 \(-74\.7%\)/,
    );
    assertNoMatch(summary, /#1 keep/);
  });
});

test("delta is computed against the first run of the same segment", () => {
  withSummary(
    [
      '{"type":"config","name":"S","metricName":"ms","metricUnit":"ms","bestDirection":"lower"}',
      '{"run":1,"commit":"a","metric":200,"status":"keep","description":"seg0 base","timestamp":1,"metrics":{}}',
      '{"type":"config","name":"S","metricName":"ms","metricUnit":"ms","bestDirection":"lower"}',
      '{"run":2,"commit":"b","metric":100,"status":"keep","description":"seg1 base","timestamp":2,"metrics":{}}',
      '{"run":3,"commit":"c","metric":80,"status":"keep","description":"seg1 better","timestamp":3,"metrics":{}}',
    ],
    (summary) => {
      assertMatch(
        summary,
        /#2 keep\s+100 \| desc: seg1 base/,
        /#3 keep\s+80 \(-20\.0%\) \| desc: seg1 better/,
        /#1 keep\s+200 \| desc: seg0 base/,
      );
    },
  );
});
