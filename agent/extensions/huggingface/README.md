# huggingface

Hugging Face model discovery + inspection + discussion tooling.

## Tools

- `search-huggingface-models`
  - Query models with filters (tags, author, pipeline, library, date windows, gated, sort).
- `get-huggingface-model`
  - Deep model inspection (metadata, files/tree, model card).
  - For GGUF repos: quant file table + quant format summary.
- `list-huggingface-discussions`
  - Lists model discussions/PR threads with filter options.
- `get-huggingface-discussion`
  - Renders a full discussion thread timeline.

## What makes it non-trivial

- Fetches model details, tree, and README concurrently.
- Parses tags into normalized fields (license/base model/papers).
- Derives GGUF quant format hints from filenames.
- Produces compact, table-based terminal output with structured details.

## Data source

- `https://huggingface.co/api`
- README fetch fallback checks `main` then `master`.
