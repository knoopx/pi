import type { Parser } from "./types.js";

/** Create a parser with standard URL matching and dispatch. */
export function defineParser<T>(
  domain: string,
  matches: (url: string) => boolean,
  parse: (url: string) => T | null,
  convert: (parsed: T, signal?: AbortSignal) => Promise<string>,
): Parser {
  return {
    matches,
    convert: async (url: string, signal?: AbortSignal): Promise<string> => {
      const parsed = parse(url);
      if (!parsed) throw new Error(`Unable to parse ${domain} URL: ${url}`);
      return convert(parsed, signal);
    },
  };
}
