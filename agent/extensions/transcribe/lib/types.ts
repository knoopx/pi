import type { Root as MdastRoot } from "mdast";

export type ParseResult = MdastRoot | string;

export interface Parser {
  matches(source: string): boolean;
  convert(source: string, signal?: AbortSignal): Promise<ParseResult>;
}
