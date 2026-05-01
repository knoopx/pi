import { describe, it, expect } from "vitest";
import type { Root } from "mdast";
import { parseMarkdown, chunkByElements, stripFrontmatter } from "./parser";

function parse(text: string): Root {
  return parseMarkdown(text);
}

describe("stripFrontmatter", () => {
  it("removes the frontmatter block", () => {
    const input = "---\nname: test\n---\n# Hello\nWorld";
    expect(stripFrontmatter(input)).toBe("# Hello\nWorld");
  });

  it("handles frontmatter with trailing whitespace trimmed", () => {
    const input = "---\nkey: value\n---\n\ncontent";
    expect(stripFrontmatter(input)).toBe("content");
  });

  it("returns content unchanged when no frontmatter", () => {
    expect(stripFrontmatter("# Hello\nWorld")).toBe("# Hello\nWorld");
  });

  it("returns empty string for empty input", () => {
    expect(stripFrontmatter("")).toBe("");
  });

  it("handles Windows line endings", () => {
    const input = "---\r\nname: test\r\n---\r\n# Hello";
    expect(stripFrontmatter(input)).toBe("# Hello");
  });
});

describe("chunkByElements", () => {
  it("produces heading chunks plus body text under each heading", () => {
    const tree = parse(`# Introduction

Some intro text. Here is more.

## Setup

Install the package.`);
    const chunks = chunkByElements(tree);

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    const allText = chunks.map((c) => c.text).join("\n");
    expect(allText).toContain("# Introduction");
    expect(allText).toContain("Some intro text");
    expect(allText).toContain("# Setup");
    expect(allText).toContain("Install the package");
  });

  it("splits paragraphs into sentences", () => {
    const tree = parse(`# Section

First sentence. Second sentence. Third one!`);
    const chunks = chunkByElements(tree);

    // Heading + at least 2-3 sentence chunks.
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // Body chunks contain both heading context and sentence text.
    const sentences = chunks.filter(
      (c) => c.text.includes("\n") && c.text.includes("sentence"),
    );
    expect(sentences.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps code blocks atomic", () => {
    const tree = parse(`# Code Example

\`javascript
const a = 1;
const b = 2;
\``);
    const chunks = chunkByElements(tree);

    const codeChunks = chunks.filter((c) => c.text.includes("const a"));
    expect(codeChunks).toHaveLength(1);
    expect(codeChunks[0].text).toContain("const b");
  });

  it("produces individual list item chunks", () => {
    const tree = parse(`# Items

- First item text.
- Second item text.`);
    const chunks = chunkByElements(tree);

    const itemChunks = chunks.filter((c) => c.text.includes("item"));
    expect(itemChunks.length).toBeGreaterThanOrEqual(2);
  });

  it("produces individual table row chunks", () => {
    const tree = parse(`# Table

| A | B |
|---|---|
| x | y |`);
    const chunks = chunkByElements(tree);

    // Heading + at least one data row chunk.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const allText = chunks.map((c) => c.text).join("\n");
    expect(allText).toContain("x");
  });

  it("attaches heading context to child chunks", () => {
    const tree = parse(`# My Skill

This is the content.`);
    const chunks = chunkByElements(tree);

    const bodyChunk = chunks.find((c) => c.text.includes("content"));
    expect(bodyChunk).toBeDefined();
    expect(bodyChunk!.text).toContain("# My Skill");
  });

  it("produces no chunks for empty document", () => {
    expect(chunkByElements(parse(""))).toHaveLength(0);
  });

  it("produces non-empty chunks for headings-only document", () => {
    const tree = parse(`# First

## Second`);
    const chunks = chunkByElements(tree);

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.text.trim()).not.toBe("");
    }
  });

  it("does not produce oversized chunks from table rows", () => {
    // Build a table with many columns to simulate the real Helix language table.
    const cols = Array.from({ length: 20 }, (_, i) => `Col${i}`).join(" | ");
    const sep = Array.from({ length: 20 }, () => "---").join("|");
    const row = Array.from({ length: 20 }, (_, i) => `val${i}`).join(" | ");

    const tree = parse(`# Big Table

| ${cols} |
| ${sep} |
| ${row} |`);
    const chunks = chunkByElements(tree);

    // No single chunk should exceed 500 chars (a row with 20 cells is still small per-row).
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThan(500);
    }
  });
});
