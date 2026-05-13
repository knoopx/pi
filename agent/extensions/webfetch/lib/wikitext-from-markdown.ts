import type { Link } from "mdast";

function parseWikiLinkContent(content: string): {
  page: string;
  display?: string;
} {
  let inner = content;
  if (inner.startsWith("[[")) inner = inner.slice(2);
  if (inner.endsWith("]]") && inner.length > 2) inner = inner.slice(0, -2);

  const [page, display] = splitWikiLink(inner);
  return { page, display };
}

function splitWikiLink(text: string): [string, string | undefined] {
  const pipeIndex = text.indexOf("|");
  if (pipeIndex === -1) return [text, undefined];
  return [text.slice(0, pipeIndex), text.slice(pipeIndex + 1).trimStart()];
}

export function createWikitextFromMarkdown() {
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
    const cleaned = cleanHeadingText(this.sliceSerialize(token));
    if (cleaned) {
      const node = this.stack[this.stack.length - 1] as
        | { children: unknown[] }
        | undefined;
      if (node && "children" in node && Array.isArray(node.children)) {
        node.children.push({ type: "text", value: cleaned });
      }
    }
    this.exit(token);
  }

  function cleanHeadingText(text: string): string {
    return text
      .replace(/^=+\s*/, "")
      .replace(/\s*=+$/, "")
      .trim();
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

  function enterWikiLink(
    this: { enter: (node: Record<string, unknown>, token: unknown) => void },
    token: unknown,
  ) {
    this.enter(
      { type: "wikiLink" } as unknown as Record<string, unknown>,
      token,
    );
  }

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

    replaceWikiLinkInStack(this.stack, linkNode);
    this.exit(token);
  }

  function replaceWikiLinkInStack(
    stack: Array<Record<string, unknown>>,
    linkNode: Link,
  ): void {
    if (stack.length < 2) return;

    const currentNode = stack[stack.length - 1] as { type: string };
    if (currentNode.type !== "wikiLink") return;

    const parent = stack[stack.length - 2] as { children?: unknown[] };
    if (!parent || !Array.isArray(parent.children)) return;

    const lastIdx = parent.children.length - 1;
    if (lastIdx >= 0 && parent.children[lastIdx] === currentNode) {
      parent.children[lastIdx] = linkNode;
    }
  }
}
