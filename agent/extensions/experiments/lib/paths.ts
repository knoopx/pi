import * as path from "node:path";

export const experimentJsonlPath = (dir: string) =>
  path.join(dir, "experiment.jsonl");
export const experimentMdPath = (dir: string) =>
  path.join(dir, "experiment.md");
export const experimentChecksPath = (dir: string) =>
  path.join(dir, "experiment.checks.sh");
export const experimentScriptPath = (dir: string) =>
  path.join(dir, "experiment.sh");
export const experimentConfigPath = (dir: string) =>
  path.join(dir, "experiment.config.json");
