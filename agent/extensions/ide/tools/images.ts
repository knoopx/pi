type ImageProtocol = "iterm2" | "kitty" | "none";

export const IS_TMUX = !!process.env.TMUX;

export function getOuterTerminal(): string {
  const term = process.env.TERM_PROGRAM ?? "";
  if (term !== "tmux" && term !== "screen") return term;

  if (process.env.LC_TERMINAL === "iTerm2") return "iTerm.app";
  if (process.env.GHOSTTY_RESOURCES_DIR) return "ghostty";
  if (
    process.env.COLORTERM === "truecolor" ||
    process.env.COLORTERM === "24bit"
  ) {
    return "unknown-modern";
  }
  return term;
}

export function detectImageProtocol(): ImageProtocol {
  const term = getOuterTerminal();
  if (term === "ghostty" || term === "kitty") return "kitty";
  if (["iTerm.app", "WezTerm", "mintty"].includes(term)) return "iterm2";
  if (process.env.LC_TERMINAL === "iTerm2") return "iterm2";
  return "none";
}

export function tmuxWrap(seq: string): string {
  if (!IS_TMUX) return seq;
  const escaped = seq.split("\x1b").join("\x1b\x1b");
  return `\x1bPtmux;${escaped}\x1b\\`;
}

export function renderIterm2Image(
  base64Data: string,
  opts: { width?: string; name?: string } = {},
): string {
  const args: string[] = ["inline=1", "preserveAspectRatio=1"];
  if (opts.width) args.push(`width=${opts.width}`);
  if (opts.name) args.push(`name=${Buffer.from(opts.name).toString("base64")}`);
  const byteSize = Math.ceil((base64Data.length * 3) / 4);
  args.push(`size=${byteSize}`);
  const seq = `\x1b]1337;File=${args.join(";")}:${base64Data}\x07`;
  return tmuxWrap(seq);
}

export function renderKittyImage(
  base64Data: string,
  opts: { cols?: number } = {},
): string {
  const chunks: string[] = [];
  const CHUNK_SIZE = 4096;

  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    const chunk = base64Data.slice(i, i + CHUNK_SIZE);
    const isFirst = i === 0;
    const isLast = i + CHUNK_SIZE >= base64Data.length;
    const more = isLast ? 0 : 1;

    if (isFirst) {
      const colPart = opts.cols ? `,c=${opts.cols}` : "";
      chunks.push(
        tmuxWrap(`\x1b_Ga=T,f=100,t=d,m=${more}${colPart};${chunk}\x1b\\`),
      );
    } else {
      chunks.push(tmuxWrap(`\x1b_Gm=${more};${chunk}\x1b\\`));
    }
  }

  return chunks.join("");
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
