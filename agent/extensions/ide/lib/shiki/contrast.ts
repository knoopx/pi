const ANSI_CAPTURE_RE = /\x1b\[([0-9;]*)m/g;
const LOW_CONTRAST_CODES = new Set(["30", "90", "38;5;0", "38;5;8"]);

function isLowContrastRgb(params: string): boolean {
  const parts = params.split(";").map(Number);
  if (parts.length !== 5 || parts.some((n) => !Number.isFinite(n)))
    return false;
  const [, , r, g, b] = parts;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 72;
}

function isLowContrastShikiFg(params: string): boolean {
  if (LOW_CONTRAST_CODES.has(params)) return true;
  if (!params.startsWith("38;2;")) return false;
  return isLowContrastRgb(params);
}
export function normalizeShikiContrast(
  ansi: string,
  mutedColor: string,
): string {
  return ansi.replace(ANSI_CAPTURE_RE, (seq, params: string) =>
    isLowContrastShikiFg(params) ? mutedColor : seq,
  );
}
