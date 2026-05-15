import picomatch from "picomatch";

export function matchFileNamePattern(
  filePath: string,
  pattern: string,
): boolean {
  if (!filePath || !pattern) return false;
  const basename = filePath.split(/[\/\\]/).pop() ?? filePath;

  if (pattern.includes("/") || pattern.includes("\\")) {
    return picomatch.isMatch(filePath, pattern, { dot: true });
  }
  return picomatch.isMatch(basename, pattern, { dot: true });
}

export function matchContentPattern(content: string, pattern: string): boolean {
  if (!content || !pattern) return false;
  const alternatives = pattern
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  return alternatives.some((alt) => content.includes(alt));
}
