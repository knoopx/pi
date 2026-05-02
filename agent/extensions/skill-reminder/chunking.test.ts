import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  chunkByElements,
  stripFrontmatter,
  parseFrontmatter,
} from "./parser";

describe("stripFrontmatter", () => {
  it("removes YAML frontmatter delimiters and content", () => {
    const raw = `---
name: test
keywords: "a,b,c"
---

# Heading

Body text`;

    const result = stripFrontmatter(raw);
    expect(result).toEqual(`# Heading\n\nBody text`);
  });

  it("returns full text when no frontmatter present", () => {
    const raw = "# Heading\n\nBody text";
    expect(stripFrontmatter(raw)).toEqual(raw);
  });

  it("handles missing closing delimiter gracefully", () => {
    const raw = `---
name: test

# Heading`;
    // No closing ---, so frontmatter is not detected.
    expect(stripFrontmatter(raw)).toContain("# Heading");
  });
});

describe("parseFrontmatter", () => {
  it("parses simple key-value pairs", () => {
    const raw = `---
name: my-skill
keywords: "a,b,c"
description: Some description
---

# Content`;

    const fm = parseFrontmatter(raw);
    expect(fm.name).toBe("my-skill");
    expect(fm.keywords).toBe("a,b,c");
    expect(fm.description).toBe("Some description");
  });

  it("handles quoted values", () => {
    const raw = `---
name: "quoted-name"
keywords: 'single,quoted'
---`;

    const fm = parseFrontmatter(raw);
    expect(fm.name).toBe("quoted-name");
    expect(fm.keywords).toBe("single,quoted");
  });

  it("returns empty object when no frontmatter", () => {
    expect(parseFrontmatter("# Heading\n\nBody")).toEqual({});
  });
});

describe("chunkByElements", () => {
  function chunk(md: string) {
    const tree = parseMarkdown(md);
    return chunkByElements(tree);
  }

  it("produces one chunk per heading and body element", () => {
    const md = `# Section A
Content A.

# Section B
Content B.`;

    const result = chunk(md);
    expect(result.length).toBeGreaterThanOrEqual(4);
    const allText = result.map((c) => c.text).join("\n");
    expect(allText).toContain("# Section A");
    expect(allText).toContain("Content A");
    expect(allText).toContain("# Section B");
    expect(allText).toContain("Content B");
  });

  it("attaches heading context to body chunks", () => {
    const md = `# Parent
Intro text.

## Child
Child content.`;

    const result = chunk(md);
    // Body chunk contains both heading context and body text.
    const childBody = result.find(
      (c) => c.text.includes("Child content") && c.text.includes("\n"),
    );
    expect(childBody).toBeDefined();
    expect(childBody!.text).toContain("# Child");
  });

  it("does not duplicate heading text in body", () => {
    const md = `# Quick Start
Run the command now.

## Config
Set values here.`;

    const result = chunk(md);
    for (const c of result) {
      // Heading appears exactly once, not duplicated.
      const matches = c.text.match(/Quick Start/g);
      if (matches) expect(matches.length).toBeLessThanOrEqual(1);
    }
  });

  it("produces chunks for headings even with no body", () => {
    const md = `# Empty

# Has Content
Real text here.`;

    const result = chunk(md);
    expect(result.find((c) => c.text.includes("# Empty"))).toBeDefined();
  });

  it("preserves code block as single atomic chunk", () => {
    const md = `# Code Section

\`\`\`bash
nix build .
echo hello
\`\`\`

More text.`;

    const result = chunk(md);
    const codeChunk = result.find((c) => c.text.includes("nix build"));
    expect(codeChunk).toBeDefined();
    expect(codeChunk!.text).toContain("echo hello");
  });

  it("splits list items into separate chunks", () => {
    const md = `# Items

- First item.
- Second item.`;

    const result = chunk(md);
    const items = result.filter((c) => c.text.includes("item"));
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("splits table rows into separate chunks", () => {
    const md = `# Table

| A | B |
|---|---|
| x | y |`;

    const result = chunk(md);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const allText = result.map((c) => c.text).join("\n");
    expect(allText).toContain("x");
  });

  it("handles pre-heading content without heading context", () => {
    const md = `Intro paragraph before any heading.

# First Section
Section content.`;

    const result = chunk(md);
    // Intro paragraph appears without heading prefix.
    const introChunk = result.find(
      (c) => c.text.includes("Intro") && !c.text.includes("#"),
    );
    expect(introChunk).toBeDefined();
  });

  it("handles nested headings as separate chunks", () => {
    const md = `# Level 1
Level 1 text.

## Level 2
Level 2 text.`;

    const result = chunk(md);
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.find((c) => c.text.includes("# Level 1"))).toBeDefined();
    expect(result.find((c) => c.text.includes("# Level 2"))).toBeDefined();
  });

  it("handles markdown links in content", () => {
    const md = `# Links Section
See [the docs](./ref.md) for details.`;

    const result = chunk(md);
    const bodyChunk = result.find((c) => c.text.includes("docs"));
    expect(bodyChunk).toBeDefined();
  });

  it("splits large table rows into manageable chunks", () => {
    // Build a table with many columns.
    const cols = Array.from({ length: 20 }, (_, i) => `Col${i}`).join(" | ");
    const sep = Array.from({ length: 20 }, () => "---").join("|");
    const row = Array.from({ length: 20 }, (_, i) => `val${i}`).join(" | ");

    const md = `# Big Table

| ${cols} |
| ${sep} |
| ${row} |`;

    const result = chunk(md);
    for (const c of result) {
      expect(c.text.length).toBeLessThan(500);
    }
  });
});
