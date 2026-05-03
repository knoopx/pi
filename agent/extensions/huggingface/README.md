# huggingface

Hugging Face model search + discussion listing.

## Tools

- `search-huggingface-models`
  - Query models with filters (tags, author, pipeline, library, date windows, gated, sort).
- `list-huggingface-discussions`
  - Lists model discussions/PR threads with filter options.

## What makes it non-trivial

- Concurrent API fetching for search results and discussion listings.
- Parses tags into normalized fields (license/base model/papers).
- Produces compact, table-based terminal output with structured details.

## Data source

- `https://huggingface.co/api`
