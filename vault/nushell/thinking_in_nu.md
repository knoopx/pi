# Thinking in Nu

Nushell is shell-first, but it behaves more like a data language than a text-only command interpreter.

## Key differences from Bash-style shells

- Pipelines pass typed values (tables, records, lists), not only strings.
- Many operations are built-in and data-aware, so fewer external text tools are needed.
- Operators and syntax are consistent with programming-language expectations.

## Practical mindset

- Think in terms of transforming values step by step.
- Prefer structured commands (`where`, `sort-by`, `get`, `update`) over regex-heavy parsing.
- Treat shell scripts as maintainable programs, not only command chains.

## Recommended follow-up

- [Quick Tour](/book/quick_tour.html)
- [Types of Data](/book/types_of_data.html)
- [Coming to Nu](/book/coming_to_nu.html)
