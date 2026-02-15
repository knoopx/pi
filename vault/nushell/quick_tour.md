# Quick Tour

Nushell commands return structured data, not raw text. This makes pipelines easier to compose and transform.

## Core workflow

- Run a command like `ls` to get a table.
- Pipe that output into table-aware commands such as `sort-by`, `where`, `select`, and `get`.
- Continue piping until the result matches exactly what you need.

## Typical examples

```nu
ls | sort-by size | reverse
ls | where type == file
ls | select name size modified
```

## Why this matters

- You filter by values, not fragile text parsing.
- Commands remain composable and predictable.
- Data stays typed across the pipeline.

## Next steps

- [Thinking in Nu](/book/thinking_in_nu.html)
- [Types of Data](/book/types_of_data.html)
