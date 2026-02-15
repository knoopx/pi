# Types of Data

Nushell pipelines carry typed values. Commands can use type information directly, which reduces parsing errors.

## Common value types

- Scalars: `int`, `float`, `string`, `bool`, `date`, `duration`, `filesize`, `binary`
- Structured: `list`, `record`, `table`
- Special: `range`, `closure`, `block`, `null`, `any`

## Inspect type

```nu
42 | describe
```

## Why types help

- Sorting and filtering work on actual values.
- Units like file sizes and durations are understood natively.
- Pipelines are easier to reason about and refactor.

## Keep learning

- [Language Reference Guide](/lang-guide/)
- [Command Reference](/commands/)
