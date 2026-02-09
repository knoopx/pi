# Markdown RAG Extension

A RAG (Retrieval-Augmented Generation) extension for markdown files that uses mdast AST parsing for intelligent chunking and semantic search.

## Features

- **AST-based chunking**: Parses markdown using mdast to create semantically meaningful chunks
- **Heading-aware sections**: Groups content by headings and maintains heading hierarchy context
- **GFM support**: Handles GitHub Flavored Markdown (tables, task lists, etc.)
- **Semantic search**: Uses transformer embeddings for similarity-based retrieval
- **Persistent cache**: Index is saved to `~/.cache/pi-rag/store.json` and loaded on startup

## Tools

### `rag-search`

Search indexed markdown files using semantic similarity.

**Parameters:**

- `query` (required): Search query text
- `limit` (optional): Maximum results (default: 5)
- `minSimilarity` (optional): Minimum similarity threshold 0-1 (default: 0.3)
- `filePath` (optional): Filter to a specific file

## Commands

### `/rag-index <glob-patterns...>`

Index markdown files for RAG search.

```
/rag-index ./docs/**/*.md ./README.md
```

### `/rag-stats`

Show statistics about the current RAG index (total chunks, files, chunk types).

### `/rag-clear [file-path]`

Clear the RAG index. Optionally specify a file path to clear only that file.

```
/rag-clear              # Clear entire index
/rag-clear ./README.md  # Clear specific file
```

## Chunking Strategy

The extension uses mdast to parse markdown and creates chunks based on:

1. **Section grouping**: Content is grouped under its nearest heading
2. **Heading context**: Each chunk includes its heading hierarchy (e.g., "Main > Sub > Sub-sub")
3. **Smart splitting**: Large sections are split at paragraph/sentence boundaries
4. **Code preservation**: Code blocks are kept with their language metadata

## Example Usage

```
# Index documentation
/rag-index ./docs/**/*.md ./README.md

# Search for relevant content
rag-search(query: "how to configure authentication")

# Check index status
/rag-stats

# Clear and re-index
/rag-clear
```

## Embedding Models

The default model is `Xenova/all-MiniLM-L6-v2`, which provides a good balance of speed and quality. Alternative models from Hugging Face Transformers.js can be used:

- `Xenova/all-MiniLM-L6-v2` (default, 384 dimensions)
- `Xenova/all-mpnet-base-v2` (768 dimensions, higher quality)
- `Xenova/paraphrase-MiniLM-L6-v2` (384 dimensions)

## Dependencies

- `mdast-util-from-markdown`: Markdown to AST parsing
- `mdast-util-to-string`: Text extraction from AST nodes
- `mdast-util-gfm`: GitHub Flavored Markdown support
- `@huggingface/transformers`: Embedding generation
