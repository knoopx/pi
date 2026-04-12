import type { Theme } from "@mariozechner/pi-coding-agent";

const SYMBOL_TYPE_ICONS: Record<string, string> = {
  f: "󰊕",
  m: "󰆧",
  c: "󰠱",
  if: "󰰮",
  ty: "󰗴",
  h: "󰉫",
  cb: "󰅩",
  e: "󰙅",
  v: "󰀫",
  function: "󰊕",
  method: "󰆧",
  class: "󰠱",
  interface: "󰰮",
  type: "󰗴",
  enum: "󰙅",
  variable: "󰀫",
  property: "󰜢",
  constant: "󰏿",
  module: "󰆧",
  namespace: "󰅩",
  struct: "󰙅",
};

function getSymbolIcon(type: string): string {
  return SYMBOL_TYPE_ICONS[type] || "󰈚";
}

export function formatSymbolListEntry(
  theme: Theme,
  opts: {
    type: string;
    name: string;
    path: string;
    line: number;
    signature?: string;
  },
): string {
  const icon = getSymbolIcon(opts.type);
  const pathShort = opts.path.replace(/^\.\//, "");
  const signatureText = opts.signature
    ? theme.fg("dim", ` ${opts.signature}`)
    : "";
  const location = theme.fg("dim", `${pathShort}:${String(opts.line)}`);
  return `${icon} ${opts.name}${signatureText} ${location}`;
}
