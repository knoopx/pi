# Transcribe Extension

Convert web pages and local files to clean Markdown text using the mdast ecosystem.

## How It Works

- **URLs** are fetched with `fetch()` using browser-like headers
- **HTML** is parsed via `hast-util-from-html` → `hast-util-to-mdast`
- **Markdown/text** is parsed via `mdast-util-from-markdown`
- The mdast tree is cleaned (scripts, styles, excessive whitespace removed)
- Output is serialized via `mdast-util-to-markdown` with GFM support

No external CLI dependencies required.

## Tools

### transcribe

**Label:** Transcribe

**Description:** Convert various file formats and web content to Markdown text.

Use this to:

- Convert documents to readable text
- Extract content from PDFs and Office files
- Transcribe web pages to Markdown
- Process various file formats

Supports URLs and local files.

**Parameters:**

- `source` (string): URL or file path to transcribe into human-readable text
