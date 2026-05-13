# Webfetch Extension

Convert web pages and local files to clean Markdown text using the mdast ecosystem.

## How It Works

- **URLs** are fetched with `fetch()` using browser-like headers
- **HTML** is parsed via `hast-util-from-html` → `hast-util-to-mdast`
- **Markdown/text** is parsed via `mdast-util-from-markdown`
- The mdast tree is cleaned (scripts, styles, excessive whitespace removed)
- Output is serialized via `mdast-util-to-markdown` with GFM support

No external CLI dependencies required.

## Tools

### web-fetch

**Label:** Web Fetch

**Description:** Fetch web content and convert files to Markdown text.

Use this to:

- Fetch web pages and convert to Markdown
- Convert documents to readable text
- Extract content from PDFs and Office files
- Process various file formats

Supports URLs and local files.

**Parameters:**

- `source` (string): URL or file path to fetch and convert to human-readable text
