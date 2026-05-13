import type {
  Extension as MicromarkExtension,
  Construct,
} from "micromark-util-types";
import { codes } from "micromark-util-symbol";

interface Effects {
  enter: (type: string) => void;
  consume: (code: number) => void;
  exit: (type: string) => void;
}

export function createWikitextSyntax(): MicromarkExtension {
  return {
    flow: {
      [codes.equalsTo]: constructHeading as unknown as Construct,
      [codes.dash]: constructThematicBreak as unknown as Construct,
    },
    text: {
      [codes.apostrophe]: constructAttention as unknown as Construct,
      [codes.leftCurlyBrace]: constructTemplate as unknown as Construct,
      [codes.leftSquareBracket]: constructWikiLink as unknown as Construct,
    },
  };
}

const constructHeading = {
  tokenize: tokenizeHeading,
};

function tokenizeHeading(
  this: { previous: number | undefined },
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  let depth = 0;
  let closeCount = 0;

  return start;

  function start(code: number) {
    if (code !== codes.equalsTo) return nok(code);
    depth = 1;
    effects.enter("wikitextHeading");
    effects.consume(code);
    return inSequence;
  }

  function inSequence(code: number) {
    if (code === codes.equalsTo) {
      depth++;
      effects.consume(code);
      return inSequence;
    }
    if (!isHeadingValid(code)) {
      depth = 0;
      return nok(code);
    }

    effects.consume(code);
    closeCount = 0;
    return inContent;
  }

  function isHeadingValid(code: number): boolean {
    if (depth < 2 || code === codes.eof) return false;
    return code === codes.space;
  }

  function inContent(code: number) {
    if (code === codes.eof) {
      return nok(code);
    }
    if (code === codes.equalsTo) {
      closeCount++;
      effects.consume(code);
      return checkClose;
    }
    effects.consume(code);
    closeCount = 0;
    return inContent;
  }

  function checkClose(code: number) {
    if (code === codes.equalsTo) {
      closeCount++;
      effects.consume(code);
      return checkClose;
    }
    if (closeCount >= 2 && closeCount >= depth) {
      effects.exit("wikitextHeading");
      return ok(code);
    }
    return nok(code);
  }
}

const constructThematicBreak = {
  tokenize: tokenizeThematicBreak,
};

function tokenizeThematicBreak(
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  let count = 0;

  return start;

  function start(code: number) {
    if (code !== codes.dash) return nok(code);
    effects.enter("wikitextThematicBreak");
    count = 1;
    return inside(code);
  }

  function inside(code: number) {
    if (code === codes.dash) {
      count++;
      effects.consume(code);
      return inside;
    }
    if (count >= 3) {
      effects.exit("wikitextThematicBreak");
      return ok(code);
    }
    return nok(code);
  }
}

const constructAttention = {
  tokenize: tokenizeAttention,
};

function tokenizeAttention(
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  let _count = 0;
  let ch = 0;

  return start;

  function start(code: number) {
    ch = code;
    _count = 1;
    effects.enter("wikitextAttentionSequence");
    effects.consume(code);
    return inside;
  }

  function inside(code: number) {
    if (code === ch) {
      _count++;
      effects.consume(code);
      return inside;
    }
    effects.exit("wikitextAttentionSequence");
    return nok(code);
  }
}

function createBracketPairTokenizer(
  openCode: number,
  closeCode: number,
  type: string,
  rejectCodes?: Set<number>,
): unknown {
  return {
    tokenize: (
      effects: Effects,
      ok: (code: number) => void,
      nok: (code: number) => void,
    ) => {
      let depth = 0;
      return start;

      function start(code: number) {
        if (code !== openCode) return nok(code);
        effects.enter(type);
        effects.consume(code);
        depth = 1;
        return inside;
      }

      function inside(code: number) {
        if (shouldReject(code)) {
          effects.exit(type);
          return nok(code);
        }
        if (code === openCode) {
          depth++;
          effects.consume(code);
          return inside;
        }
        if (code === closeCode) {
          effects.consume(code);
          depth--;
          if (depth === 0) {
            effects.exit(type);
            return ok;
          }
          return inside;
        }

        effects.consume(code);
        return inside;
      }

      function shouldReject(code: number): boolean {
        return code === codes.eof || rejectCodes?.has(code) === true;
      }
    },
  };
}

const constructTemplate = createBracketPairTokenizer(
  codes.leftCurlyBrace,
  codes.rightCurlyBrace,
  "wikitextTemplate",
  new Set([codes.lineFeed, codes.carriageReturn]),
) as Construct;

const constructWikiLink = createBracketPairTokenizer(
  codes.leftSquareBracket,
  codes.rightSquareBracket,
  "wikitextWikiLink",
) as Construct;
