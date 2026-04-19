import type { StatSyncFn } from "node:fs";
import type { FileInfo } from "./types";

export function getMtimeSorter(
  cwd: string,
  statSync: StatSyncFn,
  join: (a: string, b: string) => string,
) {
  return (a: FileInfo, b: FileInfo) => {
    let mtimeA = 0;
    let mtimeB = 0;
    try {
      mtimeA = statSync(join(cwd, a.path)).mtimeMs;
    } catch {
      /* use default */
    }
    try {
      mtimeB = statSync(join(cwd, b.path)).mtimeMs;
    } catch {
      /* use default */
    }
    return mtimeB - mtimeA;
  };
}
