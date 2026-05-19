import type { FileInfo } from "./types";
export function getMtimeSorter(
  cwd: string,
  statSync: (path: string) => { mtimeMs: number },
  join: (a: string, b: string) => string,
) {
  return (a: FileInfo, b: FileInfo) => {
    let mtimeA = 0;
    let mtimeB = 0;
    try {
      mtimeA = statSync(join(cwd, a.path)).mtimeMs;
    } catch {
      // File not accessible, default to 0
    }
    try {
      mtimeB = statSync(join(cwd, b.path)).mtimeMs;
    } catch {
      // File not accessible, default to 0
    }
    return mtimeB - mtimeA;
  };
}
