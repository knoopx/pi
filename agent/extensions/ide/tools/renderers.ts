import type { Theme } from "@mariozechner/pi-coding-agent";
import { dirname, basename } from "node:path";
import { hlBlock, MAX_PREVIEW_LINES } from "./shiki";
import { fileIconGlyph, dirIconGlyph } from "./icons";
import { termW, strip } from "./utils";
import { lang } from "./language";

export async function renderFileContent(
  content: string,
  filePath: string,
  offset: number,
  maxLines: number,
  theme: Theme,
): Promise<string> {
  const lines = content.split("\n");
  const total = lines.length;
  const show = lines.slice(0, maxLines);
  const lg = lang(filePath);
  const mutedColor = theme.getFgAnsi("muted");
  const hl = await hlBlock(show.join("\n"), lg, mutedColor);

  const tw = termW();
  const startLine = offset;
  const endLine = startLine + show.length - 1;
  const nw = Math.max(3, String(endLine).length);

  const out: string[] = [];
  out.push(theme.fg("border", "─".repeat(tw)));

  for (let i = 0; i < hl.length; i++) {
    const ln = startLine + i;
    const code = hl[i] ?? show[i] ?? "";
    const plain = strip(code);
    let display = code;
    if (plain.length > tw - nw - 4) {
      let vis = 0;
      let j = 0;
      while (j < code.length && vis < tw - nw - 5) {
        if (code[j] === "\x1b") {
          const e = code.indexOf("m", j);
          if (e !== -1) {
            j = e + 1;
            continue;
          }
        }
        vis++;
        j++;
      }
      display = `${code.slice(0, j)}${theme.fg("muted", "›")}`;
    }
    const lnStr = " ".repeat(Math.max(0, nw - String(ln).length)) + ln;
    out.push(
      `${theme.fg("muted", lnStr)} ${theme.fg("border", "│")} ${display}`,
    );
  }

  out.push(theme.fg("border", "─".repeat(tw)));
  if (total > maxLines) {
    out.push(
      theme.fg("dim", `  … ${total - maxLines} more lines (${total} total)`),
    );
  }
  return out.join("\n");
}

export function renderBashOutput(
  text: string,
  exitCode: number | null,
  theme: Theme,
): { summary: string; body: string } {
  const isOk = exitCode === 0;
  const statusColor = isOk ? "success" : "error";
  const statusIcon = isOk ? "✓" : "✗";
  const codeStr =
    exitCode !== null
      ? theme.fg(statusColor, statusIcon) + " exit " + exitCode
      : theme.fg("warning", "⚡ killed");

  const lines = text.split("\n");
  const maxShow = MAX_PREVIEW_LINES;
  const show = lines.slice(0, maxShow);
  const remaining = lines.length - maxShow;

  let body = show.join("\n");
  if (remaining > 0) {
    body += `\n${theme.fg("dim", `  … ${remaining} more lines`)}`;
  }

  return { summary: codeStr, body };
}

export function renderTree(text: string, theme: Theme): string {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return theme.fg("dim", "(empty directory)");

  const out: string[] = [];
  const total = lines.length;
  const show = lines.slice(0, MAX_PREVIEW_LINES);

  for (let i = 0; i < show.length; i++) {
    const entry = show[i].trim();
    const isLast = i === show.length - 1 && total <= MAX_PREVIEW_LINES;
    const prefix = isLast ? "└── " : "├── ";
    const connector = theme.fg("border", prefix);

    const isDir = entry.endsWith("/");
    const name = isDir ? entry.slice(0, -1) : entry;
    const icon = isDir ? dirIconGlyph() : fileIconGlyph(name);
    const fg = isDir ? theme.fg("accent", icon + name) : icon + name;

    out.push(`${connector}${fg}`);
  }

  if (total > MAX_PREVIEW_LINES) {
    out.push(
      `${theme.fg("border", "└── ")}${theme.fg("dim", `… ${total - MAX_PREVIEW_LINES} more entries`)}`,
    );
  }

  return out.join("\n");
}

export function renderFindResults(text: string, theme: Theme): string {
  const lines = text.trim().split("\n").filter(Boolean);
  if (!lines.length) return theme.fg("dim", "(no matches)");

  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const trimmed = line.trim();
    const dir = dirname(trimmed) || ".";
    const file = basename(trimmed);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(file);
  }

  const out: string[] = [];
  let count = 0;

  for (const [dir, files] of groups) {
    if (count > 0) out.push("");
    out.push(`${dirIconGlyph()}${theme.bold(theme.fg("accent", dir + "/"))}`);
    for (let i = 0; i < files.length; i++) {
      if (count >= MAX_PREVIEW_LINES) {
        out.push(theme.fg("dim", `  … ${lines.length - count} more files`));
        return out.join("\n");
      }
      const isLast = i === files.length - 1;
      const prefix = isLast ? "└── " : "├── ";
      const icon = fileIconGlyph(files[i]);
      out.push(`  ${theme.fg("border", prefix)}${icon}${files[i]}`);
      count++;
    }
  }

  return out.join("\n");
}

export async function renderGrepResults(
  text: string,
  pattern: string,
  theme: Theme,
): Promise<string> {
  const lines = text.split("\n");
  if (!lines.length || (lines.length === 1 && !lines[0].trim()))
    return theme.fg("dim", "(no matches)");

  const out: string[] = [];
  let currentFile = "";
  let count = 0;

  let re: RegExp | null;
  try {
    re = new RegExp(`(${pattern})`, "gi");
  } catch {
    re = null;
  }

  for (const line of lines) {
    if (count >= MAX_PREVIEW_LINES) {
      out.push(theme.fg("dim", "  … more matches"));
      break;
    }

    const fileRe = /^(.+?)[:-](\d+)[:-](.*)$/;
    const fileMatch = fileRe.exec(line);
    if (fileMatch) {
      const [, file, lineNo, content] = fileMatch;
      if (file !== currentFile) {
        if (currentFile) out.push("");
        const icon = fileIconGlyph(file);
        out.push(`${icon}${theme.bold(theme.fg("accent", file))}`);
        currentFile = file;
      }

      const nw = Math.max(3, lineNo.length);
      let display = content;
      if (re) {
        display = content.replace(re, theme.fg("warning", theme.bold("$1")));
      }
      const lnStr = " ".repeat(Math.max(0, nw - lineNo.length)) + lineNo;
      out.push(
        "  " +
          theme.fg("muted", lnStr) +
          " " +
          theme.fg("border", "│") +
          " " +
          display,
      );
      count++;
    } else if (line.trim() === "--") {
      out.push(theme.fg("dim", "  ···"));
    } else if (line.trim()) {
      out.push(line);
      count++;
    }
  }

  return out.join("\n");
}
