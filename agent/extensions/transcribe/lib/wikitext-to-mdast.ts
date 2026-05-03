import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfmToMarkdown } from "mdast-util-gfm";
import type { Root as MdastRoot, Content } from "mdast";
import type { Extension as MicromarkExtension } from "micromark-util-types";
import { codes } from "micromark-util-symbol";
import { visitParents } from "unist-util-visit-parents";

type Effects = {
  enter: (type: string) => void;
  consume: (code: number) => void;
  exit: (type: string) => { _count?: number } | void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createWikitextSyntax(): MicromarkExtension {
  return {
    flow: {
      [codes.equalsTo]: constructHeading as any,
      [codes.dash]: constructThematicBreak as any,
    },
    text: {
      [codes.apostrophe]: constructAttention as any,
      [codes.leftCurlyBrace]: constructTemplate as any,
    },
  };
}

const constructHeading = {
  tokenize: tokenizeHeading as (
    effects: unknown,
    ok: unknown,
    nok: unknown,
  ) => unknown,
};

function tokenizeHeading(
  this: { previous: number | undefined },
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  const ctx = this;
  let count = 0;

  return start;

  function start(code: number) {
    if (code !== codes.equalsTo) return nok(code);
    effects.enter("wikitextHeading");
    effects.consume(code);
    count = 1;
    return sequenceOpen;
  }

  function sequenceOpen(code: number) {
    if (code === codes.equalsTo && count < 6) {
      effects.consume(code);
      count++;
      return sequenceOpen;
    }
    if (count < 2) {
      effects.exit("wikitextHeading");
      return nok(code);
    }
    if (code === codes.space || code === codes.horizontalTab) {
      effects.consume(code);
      return sequenceOpen;
    }
    return content(code);
  }

  function content(code: number) {
    if (code === codes.eof || code === codes.lineFeed) {
      effects.exit("wikitextHeading");
      return ok(code);
    }
    if (code === codes.equalsTo && ctx.previous !== undefined) {
      effects.consume(code);
      return closingEquals;
    }
    if (code === codes.eof) {
      effects.exit("wikitextHeading");
      return ok(code);
    }
    effects.consume(code);
    return content;
  }

  function closingEquals(code: number) {
    if (code === codes.equalsTo) {
      effects.consume(code);
      return closingEquals;
    }
    effects.exit("wikitextHeading");
    return ok(code);
  }
}

const constructAttention = {
  tokenize: tokenizeAttention as (
    effects: unknown,
    ok: unknown,
    nok: unknown,
  ) => unknown,
};

function tokenizeAttention(
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  let count = 0;

  return start;

  function start(code: number) {
    if (code !== codes.apostrophe) return nok(code);
    effects.enter("wikitextAttentionSequence");
    effects.consume(code);
    count = 1;
    return more;
  }

  function more(code: number) {
    if (code === codes.apostrophe && count < 3) {
      effects.consume(code);
      count++;
      return more;
    }
    if (count < 2) {
      effects.exit("wikitextAttentionSequence");
      return nok(code);
    }
    const token = effects.exit("wikitextAttentionSequence") as
      | { _count?: number }
      | undefined;
    if (token) {
      token._count = count;
    }
    return ok(code);
  }
}

const constructTemplate = {
  tokenize: tokenizeTemplate as (
    effects: unknown,
    ok: unknown,
    nok: unknown,
  ) => unknown,
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
  tokenize: tokenizeWikiLink as (
    effects: unknown,
    ok: unknown,
    nok: unknown,
  ) => unknown,
};

function tokenizeWikiLink(
  this: { previous: number | undefined },
  effects: Effects,
  ok: (code: number) => void,
  nok: (code: number) => void,
): (code: number) => void {
  const ctx = this;
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

const constructThematicBreak = {
  tokenize: tokenizeThematicBreak as (
    effects: unknown,
    ok: unknown,
    nok: unknown,
  ) => unknown,
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
    effects.consume(code);
    count = 1;
    return more;
  }

  function more(code: number) {
    if (code === codes.dash && count < 4) {
      effects.consume(code);
      count++;
      return more;
    }
    if (count < 4) {
      effects.exit("wikitextThematicBreak");
      return nok(code);
    }
    effects.exit("wikitextThematicBreak");
    return ok(code);
  }
}

interface AttentionInfo {
  node: Content & { _count?: number };
  index: number;
  parent: { children: unknown[] };
}

function createWikitextFromMarkdown() {
  return {
    enter: {
      wikitextHeading: enterHeading,
      wikitextAttentionSequence: enterAttention,
      wikitextThematicBreak: enterThematicBreak,
      wikitextTemplate: enterTemplate,
    },
    exit: {
      wikitextHeading: exitHeading,
      wikitextAttentionSequence: exitAttention,
      wikitextThematicBreak: exitThematicBreak,
      wikitextTemplate: exitTemplate,
    },
    transforms: [fixAttentionNodes, removeRemovedNodes],
  };

  function enterTemplate(
    this: { enter: (node: unknown, token: unknown) => void },
    token: unknown,
  ) {
    this.enter({ type: "template" } as any, token);
  }

  function exitTemplate(
    this: { exit: (token: unknown) => void },
    token: unknown,
  ) {
    this.exit(token);
  }

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

  function enterAttention(
    this: { enter: (node: unknown, token: unknown) => void },
    token: unknown,
  ) {
    this.enter({ type: "attention", children: [], _count: 0 }, token);
  }

  function exitAttention(
    this: {
      exit: (token: unknown) => void;
      stack: Array<Record<string, unknown>>;
    },
    token: unknown,
  ) {
    const node = this.stack[this.stack.length - 1];
    if (node) {
      (node as any)._count = (token as any)._count;
    }
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

  // Transform to fix attention nodes: pair opening/closing sequences
  function fixAttentionNodes(tree: MdastRoot): MdastRoot {
    const allAttention = collectAttentionNodes(tree);
    if (allAttention.length === 0) return tree;

    pairAttentionNodes(allAttention);
    collectSiblingContent(allAttention, tree);
    removeRemovedNodes(tree);

    return tree;
  }

  function collectAttentionNodes(tree: MdastRoot): AttentionInfo[] {
    const result: AttentionInfo[] = [];
    visitParents(tree, "attention", (node, parents) => {
      const parent = parents[parents.length - 1] as { children: unknown[] };
      if (parent && Array.isArray(parent.children)) {
        const idx = parent.children.indexOf(node);
        result.push({
          node: node as Content & { _count?: number },
          index: idx,
          parent,
        });
      }
    });
    return result;
  }

  function pairAttentionNodes(attentionList: AttentionInfo[]): void {
    for (let i = 0; i < attentionList.length - 1; i += 2) {
      const openInfo = attentionList[i];
      const closeInfo = attentionList[i + 1];
      const count = (openInfo.node as any)._count ?? 2;
      const target = count >= 3 ? "strong" : "emphasis";

      (openInfo.node as any).type = target;
      delete (openInfo.node as any)._count;
      (closeInfo.node as any).type = "_removed";
    }

    if (attentionList.length % 2 === 1) {
      (attentionList[attentionList.length - 1].node as any).type = "_removed";
    }
  }

  function collectSiblingContent(
    attentionList: AttentionInfo[],
    tree: MdastRoot,
  ): void {
    for (const info of attentionList) {
      if (info.node.type !== "strong" && info.node.type !== "emphasis")
        continue;
      collectSiblings(info.parent.children, info.index, info.node);
    }
  }

  function collectSiblings(
    children: unknown[],
    startIndex: number,
    target: { children: unknown[] },
  ): void {
    let j = startIndex + 1;
    while (j < children.length) {
      const child = children[j];
      if (!child || typeof child !== "object") {
        j++;
        continue;
      }
      const c = child as { type?: string };
      if (c.type === "_removed" || c.type === "strong" || c.type === "emphasis")
        break;
      moveChildContent(target, c);
      c.type = "_removed";
      j++;
    }
  }

  function moveChildContent(
    target: { children: unknown[] },
    source: { type?: string; children?: unknown[]; value?: string },
  ): void {
    if (source.type === "text") {
      target.children.push({ type: "text", value: source.value ?? "" });
    } else if (Array.isArray(source.children)) {
      target.children.push(...source.children);
    }
  }

  function collectRemovedIndices(
    children: unknown[],
    removed: WeakSet<object>,
  ): number[] {
    const toRemove: number[] = [];
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child && typeof child === "object" && removed.has(child)) {
        toRemove.push(i);
      }
    }
    return toRemove;
  }

  function processRemovedNode(
    node: unknown,
    removed: WeakSet<object>,
  ): { shouldSkip: boolean; childrenToRemove: number[] } {
    if (!node || typeof node !== "object")
      return { shouldSkip: true, childrenToRemove: [] };
    const n = node as { type?: string; children?: unknown[] };

    if (n.type === "_removed") {
      removed.add(node);
      return { shouldSkip: true, childrenToRemove: [] };
    }

    if (!("children" in n) || !Array.isArray(n.children)) {
      return { shouldSkip: true, childrenToRemove: [] };
    }

    const toRemove = collectRemovedIndices(n.children, removed);
    return { shouldSkip: false, childrenToRemove: toRemove };
  }

  function markRemoved(tree: MdastRoot, removed: WeakSet<object>): void {
    visitParents(tree, (node) => {
      const result = processRemovedNode(node, removed);
      if (result.shouldSkip) return;
      const n = node as { children?: unknown[] };
      for (const i of result.childrenToRemove.reverse()) {
        n.children!.splice(i, 1);
      }
    });
  }

  function removeFromParents(tree: MdastRoot, removed: WeakSet<object>): void {
    visitParents(tree, (node, parents) => {
      if (!node || typeof node !== "object") return;
      const n = node as { type?: string };
      if (n.type === "_removed" && removed.has(node)) {
        const parent = parents[parents.length - 1] as { children: unknown[] };
        if (parent && Array.isArray(parent.children)) {
          const idx = parent.children.indexOf(node);
          if (idx >= 0) parent.children.splice(idx, 1);
        }
      }
    });
  }

  function removeRemovedNodes(tree: MdastRoot): void {
    const removed = new WeakSet();
    markRemoved(tree, removed);
    removeFromParents(tree, removed);

    visitParents(tree, (node, parents) => {
      if (!node || typeof node !== "object") return;
      const n = node as { type?: string };
      if (n.type === "template") {
        const parent = parents[parents.length - 1] as { children: unknown[] };
        if (parent && Array.isArray(parent.children)) {
          const idx = parent.children.indexOf(node);
          if (idx >= 0) parent.children.splice(idx, 1);
        }
      }
    });
  }
}

function convertWikiLinksInTree(tree: MdastRoot): void {
  // Collect all text nodes first (two-pass to avoid modifying during iteration)
  const textNodes: Array<{
    node: { value: string };
    parent: { children: unknown[] };
  }> = [];

  visitParents(tree, "text", (node, parents) => {
    const textNode = node as { value: string };
    if (!textNode.value) return;
    const parent = parents[parents.length - 1] as { children: unknown[] };
    if (parent && Array.isArray(parent.children)) {
      textNodes.push({ node: textNode, parent });
    }
  });

  for (let i = textNodes.length - 1; i >= 0; i--) {
    const { node, parent } = textNodes[i];
    const parts = splitWikiLinks(node.value);
    const wikiCount = parts.filter(
      (p): p is WikiLinkPart => p.type === "wiki",
    ).length;
    if (wikiCount === 0) continue; // No wiki links found

    const mdastParts: Array<
      | { type: "text"; value: string }
      | {
          type: "link";
          url: string;
          title: null;
          children: Array<{ type: "text"; value: string }>;
        }
    > = [];

    for (const part of parts) {
      if (part.type === "text") {
        mdastParts.push({ type: "text", value: part.value });
      } else {
        const page = part.page;
        if (/^Category:/i.test(page)) continue;

        const linkText = part.display || page;
        mdastParts.push({
          type: "link",
          url: page.replace(/ /g, "_"),
          title: null,
          children: [{ type: "text", value: linkText }],
        });
      }
    }

    // Replace the text node with the split parts
    const idx = parent.children.indexOf(node);
    if (idx >= 0) parent.children.splice(idx, 1, ...mdastParts);
  }
}

interface WikiLinkPart {
  type: "wiki";
  page: string;
  display?: string;
}

function splitWikiLinks(
  text: string,
): Array<{ type: "text"; value: string } | WikiLinkPart> {
  const result: Array<{ type: "text"; value: string } | WikiLinkPart> = [];
  let lastIndex = 0;
  let pos = 0;

  while (pos < text.length) {
    // Find [[ at current position
    if (text[pos] === "[" && pos + 1 < text.length && text[pos + 1] === "[") {
      if (pos > lastIndex) {
        result.push({ type: "text", value: text.slice(lastIndex, pos) });
      }

      // Find matching ]]
      let depth = 2;
      let i = pos + 2;
      while (i < text.length && depth > 0) {
        const ch = text[i];
        if (ch === "[") {
          depth++;
        } else if (ch === "]") {
          depth--;
        }
        i++;
      }

      if (depth === 0) {
        // Found complete wiki link: [[...]]
        const raw = text.slice(pos + 2, i - 2);

        // Split on first pipe for display text
        const pipeIndex = raw.indexOf("|");
        let page: string;
        let display: string | undefined;

        if (pipeIndex !== -1) {
          page = raw.slice(0, pipeIndex);
          display = raw.slice(pipeIndex + 1);
        } else {
          page = raw;
        }

        result.push({ type: "wiki", page, display });
        lastIndex = i;
        pos = i;
      } else {
        // Unterminated — treat as plain text
        pos++;
      }
    } else {
      pos++;
    }
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", value: text.slice(lastIndex) });
  }

  return result;
}

export function wikitextToMdast(wikitext: string): MdastRoot {
  const syntax = createWikitextSyntax();
  const fromMarkdownExt = createWikitextFromMarkdown();

  // @ts-expect-error - custom extension types don't match micromark types exactly
  const tree = fromMarkdown(wikitext, {
    extensions: [syntax],
    mdastExtensions: [fromMarkdownExt, gfmFromMarkdown()],
  });

  convertWikiLinksInTree(tree);

  return tree;
}

export function mdastToWikitext(tree: MdastRoot): string {
  return toMarkdown(tree, { extensions: [gfmToMarkdown()] });
}
