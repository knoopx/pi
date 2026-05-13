export interface WText {
  type: "text";
  value: string;
}

export interface WHeading {
  type: "heading";
  depth: number;
  children: WNode[];
}

export interface WWikiLink {
  type: "wikiLink";
  page: string;
  display?: string;
}

export interface WTemplate {
  type: "template";
  name: string;
  params: Array<{ key?: string; value: WNode[] }>;
}

export interface WComment {
  type: "comment";
  value: string;
}

export interface WThematicBreak {
  type: "thematicBreak";
}

export type WNode =
  | WText
  | WHeading
  | WWikiLink
  | WTemplate
  | WComment
  | WThematicBreak;

import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import type { Root as MdastRoot, Link } from "mdast";
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

function createWikitextSyntax(): MicromarkExtension {
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
    if (depth < 2 || code === codes.eof) {
      depth = 0;
      return nok(code);
    }
    if (code === codes.space) {
      effects.consume(code);
      closeCount = 0;
      return inContent;
    }
    return nok(code);
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
      count++;
      effects.consume(code);
      return inside;
    }
    effects.exit("wikitextAttentionSequence");
    return nok(code);
  }
}

const constructTemplate = {
  tokenize: tokenizeTemplate,
};

function tokenizeTemplate(
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  let depth = 0;

  return start;

  function start(code: number) {
    if (code !== codes.leftCurlyBrace) return nok(code);
    effects.enter("wikitextTemplate");
    effects.consume(code);
    depth = 1;
    return inside;
  }

  function inside(code: number) {
    if (code === codes.eof) {
      effects.exit("wikitextTemplate");
      return nok(code);
    }
    if (code === codes.lineFeed || code === codes.carriageReturn) {
      effects.exit("wikitextTemplate");
      return nok(code);
    }
    if (code === codes.leftCurlyBrace) {
      depth++;
      effects.consume(code);
      return inside;
    }
    if (code === codes.rightCurlyBrace) {
      depth--;
      if (depth === 0) {
        effects.consume(code);
        effects.exit("wikitextTemplate");
        return ok(code);
      }
      effects.consume(code);
      return inside;
    }
    effects.consume(code);
    return inside;
  }
}

const constructWikiLink = {
  tokenize: tokenizeWikiLink,
};

function tokenizeWikiLink(
  this: { previous: number | undefined },
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  let depth = 0;

  return start;

  function start(code: number) {
    if (code !== codes.leftSquareBracket) return nok(code);
    effects.enter("wikitextWikiLink");
    effects.consume(code);
    depth = 1;
    return inside;
  }

  function inside(code: number) {
    if (code === codes.eof) {
      effects.exit("wikitextWikiLink");
      return nok(code);
    }
    if (code === codes.leftSquareBracket) {
      depth++;
      effects.consume(code);
      return inside;
    }
    if (code === codes.rightSquareBracket) {
      depth--;
      if (depth === 0) {
        effects.consume(code);
        effects.exit("wikitextWikiLink");
        return ok(code);
      }
      effects.consume(code);
      return inside;
    }
    effects.consume(code);
    return inside;
  }
}

function parseWikiLinkContent(content: string): {
  page: string;
  display?: string;
} {
  // Strip [[ and ]]
  let inner = content;
  if (inner.startsWith("[[")) inner = inner.slice(2);
  if (inner.endsWith("]]") && inner.length > 2) inner = inner.slice(0, -2);

  const pipeIndex = inner.indexOf("|");
  if (pipeIndex === -1) {
    return { page: inner };
  }
  return {
    page: inner.slice(0, pipeIndex),
    display: inner.slice(pipeIndex + 1).trimStart(),
  };
}

function createWikitextFromMarkdown() {
  return {
    enter: {
      wikitextHeading: enterHeading,
      wikitextAttentionSequence: enterAttentionSeq,
      wikitextThematicBreak: enterThematicBreak,
      wikitextWikiLink: enterWikiLink,
    },
    exit: {
      wikitextHeading: exitHeading,
      wikitextAttentionSequence: exitAttentionSeq,
      wikitextThematicBreak: exitThematicBreak,
      wikitextWikiLink: exitWikiLink,
    },
  };

  function enterHeading(
    this: { enter: (node: unknown, token: unknown) => void },
    token: unknown,
  ) {
    this.enter({ type: "heading", depth: 2, children: [] }, token);
  }

  function exitHeading(
    this: {
      exit: (token: unknown) => void;
      stack: Array<{ children: unknown[] }>;
      sliceSerialize: (token: unknown) => string;
    },
    token: unknown,
  ) {
    const node = this.stack[this.stack.length - 1] as
      | { children: unknown[] }
      | undefined;
    if (node && "children" in node && Array.isArray(node.children)) {
      const text = this.sliceSerialize(token);
      const cleaned = text
        .replace(/^=+\s*/, "")
        .replace(/\s*=+$/, "")
        .trim();
      if (cleaned) {
        node.children.push({ type: "text", value: cleaned });
      }
    }
    this.exit(token);
  }

  function enterAttentionSeq(
    this: { enter: (node: unknown, token: unknown) => void },
    token: unknown,
  ) {
    this.enter({ type: "attention", children: [], _count: 0 }, token);
  }

  function exitAttentionSeq(
    this: {
      exit: (token: unknown) => void;
      stack: Array<Record<string, unknown>>;
    },
    token: unknown,
  ) {
    this.exit(token);
  }

  function enterThematicBreak(
    this: { enter: (node: unknown, token: unknown) => void },
    token: unknown,
  ) {
    this.enter({ type: "thematicBreak" }, token);
  }

  function exitThematicBreak(
    this: { exit: (token: unknown) => void },
    token: unknown,
  ) {
    this.exit(token);
  }

  // Wiki link enter - creates a placeholder node that will be replaced on exit
  function enterWikiLink(
    this: { enter: (node: Record<string, unknown>, token: unknown) => void },
    token: unknown,
  ) {
    this.enter(
      { type: "wikiLink" } as unknown as Record<string, unknown>,
      token,
    );
  }

  // Wiki link exit - replaces the wikiLink node with proper mdast link nodes
  function exitWikiLink(
    this: {
      exit: (token: unknown) => void;
      stack: Array<Record<string, unknown>>;
      sliceSerialize: (token: unknown) => string;
    },
    token: unknown,
  ) {
    const wikiText = this.sliceSerialize(token);
    const parsed = parseWikiLinkContent(wikiText);

    if (/^Category:/i.test(parsed.page)) {
      this.exit(token);
      return;
    }

    const page = parsed.page;
    const linkText = parsed.display || page;
    const linkNode: Link = {
      type: "link",
      url: page.replace(/ /g, "_"),
      title: null,
      children: [{ type: "text", value: linkText }],
      position: undefined,
    };

    // Replace the wikiLink node with the actual link node
    const stack = this.stack;
    if (stack.length >= 2) {
      const currentNode = stack[stack.length - 1] as { type: string };
      if (currentNode.type === "wikiLink") {
        const parent = stack[stack.length - 2] as { children?: unknown[] };
        if (parent && Array.isArray(parent.children)) {
          const lastIdx = parent.children.length - 1;
          if (lastIdx >= 0 && parent.children[lastIdx] === currentNode) {
            parent.children[lastIdx] = linkNode;
          }
        }
      }
    }

    this.exit(token);
  }
}

export function parseWikitext(wikitext: string): MdastRoot {
  const syntax = createWikitextSyntax();
  const fromMarkdownExt = createWikitextFromMarkdown();

  // @ts-expect-error custom extension types don't match micromark types exactly
  return fromMarkdown(wikitext, {
    extensions: [syntax],
    mdastExtensions: [fromMarkdownExt, gfmFromMarkdown()],
  });
}
