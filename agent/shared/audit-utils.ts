import type {
  ExtensionCommandContext,
  ThemeColor,
} from "@mariozechner/pi-coding-agent";

interface AuditResult {
  lines: string[];
  errors: number;
}

export function createThemeFg(
  theme: ExtensionCommandContext["ui"]["theme"],
): (color: ThemeColor, text: string) => string {
  return (color, text) =>
    theme && typeof theme.fg === "function" ? theme.fg(color, text) : text;
}

export function notifyAuditResult(
  ctx: ExtensionCommandContext,
  auditResult: AuditResult,
  fg: (color: ThemeColor, text: string) => string,
): void {
  if (auditResult.errors > 0) {
    ctx.ui?.notify(
      auditResult.lines.join("\n") +
        `\n\n${fg("error", `${auditResult.errors} pattern error(s) found.`)}`,
      "error",
    );
  } else {
    ctx.ui?.notify(auditResult.lines.join("\n"), "info");
  }
}
