# jq to Nushell Patterns

Nushell replaces `jq` for JSON processing. This reference maps common `jq` patterns to Nushell equivalents.

> **Note**: The [official jq vs Nushell cookbook](https://www.nushell.sh/cookbook/jq_v_nushell.html) is the canonical reference.

## Basic Operations

### Selecting Values

```nu
# jq: echo '{"name":"Alice"}' | jq -r '.name'
'{"name": "Alice", "age": 30}' | from json | get name
```

### Filtering Arrays

```nu
# jq: '.[] | select(.age > 28)'
'[{"name":"Alice","age":30},{"name":"Bob","age":25}]'
| from json
| where age > 28
```

### Mapping Arrays

```nu
# jq: 'map(. * 2)'
'[1, 2, 3, 4, 5]' | from json | each { $in * 2 }

# Explicit parameter binding
'[1, 2, 3]' | from json | each { |x| $x * 2 }
```

### Combining Filters

```nu
# jq: '.[] | select(.age > 28) | .name'
'[{"name":"Alice","age":30},{"name":"Bob","age":25}]'
| from json | where age > 28 | get name
```

### Splitting Strings

```nu
# jq: '.name | split(" ") | .[0]'
'{"name": "Alice Smith"}' | from json | get name | split words | get 0
```

### Conditional Logic

```nu
# jq: 'if .age > 18 then "Adult" else "Child" end'
'{"name": "Alice", "age": 30}' | from json
| if $in.age > 18 { "Adult" } else { "Child" }
```

### Handling Null Values

```nu
# jq: 'map(select(. != null))'
'[1, null, 3, null, 5]' | from json | where { $in != null }
```

### Formatting Output

```nu
# jq: "Name: \(.name), Age: \(.age)"
'{"name": "Alice", "age": 30}' | from json
| format "Name: {name}, Age: {age}"
```

### Building New Objects

```nu
# jq: '{name: .name, age: (.age + 5)}'
'{"name": "Alice", "age": 30}' | from json
| {name: $in.name, age: ($in.age + 5)}
```

## Nested Items

### Filtering Nested Arrays

```nu
# jq: '.data[].values[] | select(. > 3)'
'{"data": [{"values": [1, 2, 3]}, {"values": [4, 5, 6]}]}'
| from json | get data.values | flatten | where {|x| $x > 3}
```

### Complex Object Transformation

```nu
# jq: '.items | map({(.name): (.price * 2)}) | add'
'{"items": [{"name":"Apple","price":1},{"name":"Banana","price":0.5}]}'
| from json | get items | update price {|row| $row.price * 2}
```

## Statistical Operations

### Sorting

```nu
# jq: 'sort'
'[3, 1, 4, 2, 5]' | from json | sort
```

### Unique Values

```nu
# jq: 'unique'
'[1, 2, 2, 3, 4, 4, 5]' | from json | uniq
```

### Averages

```nu
# jq: 'map(.score) | add / length'
'[{"score":90},{"score":85},{"score":95}]' | from json | get score | math avg
```

### Grouping and Aggregating

```nu
# jq: 'group_by(.category) | map({category: .[0].category, sum: map(.value) | add})'
'[{"category":"A","value":10},{"category":"B","value":20},{"category":"A","value":5}]'
| from json
| group-by --to-table category
| update items { |row| $row.items.value | math sum }
| rename category sum
```

### Filtering After Aggregation

```nu
'[{"category":"A","value":10},{"category":"B","value":20},{"category":"A","value":5}]'
| from json
| group-by --to-table category
| update items { |row| $row.items.value | math sum }
| rename category value
| where value > 17
```

### Custom Aggregation with Reduce

```nu
# jq: 'reduce .[] as $item (0; . + $item.value)'
'[{"value":10},{"value":20},{"value":30}]'
| from json | reduce -f 0 { |item, acc| $acc + $item.value }
```

### Histogram Bins

```nu
# jq: 'group_by(. / 5 | floor * 5) | map({ bin: .[0], count: length })'
'[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]'
| from json
| group-by --to-table { $in // 5 * 5 }
| each { |row| {bin: $row.items.0, count: ($row.items | length)} }
```

## Custom Commands

Nushell has no built-in equivalents for `jq`'s recursive descent (`..`), `walk`, or path flattening. These custom commands fill the gap — load via `use toolbox.nu *`.

### cherry-pick — Recursive Key Extraction (jq `.. | .key?`)

Recursively extracts values matching a key from nested records.

```nu
export def cherry-pick [
    test               # The test function to run over each element
    list: list = []    # Initial list for collecting cherry-picked values
] {
    let input = $in

    if ($input | describe) =~ "record|table" {
        $input | values | reduce --fold $list { |value, acc|
            $acc | append [($value | cherry-pick $test)]
          }
        | prepend [(do $test $input)]
        | flatten
    } else {
        $list
    }
}

# Usage: extract all .value fields recursively
'{data: {value: 42, nested: {value: 24}}}' | from json
| cherry-pick {|x| $x.value?}
# → [null, 42, 24]
```

### walk — Recursive Transformation (jq `walk(...)`)

Traverses a data structure and applies a transformation function to every leaf value.

```nu
export def walk [mapping_fn: closure] {
    let input = $in

    match ($input | describe | str replace --regex '<.*' '') {
        "record" => {
            $input | items { |key, value|
                  {key: $key, value: ($value | walk $mapping_fn)}
              } | transpose -rd
        },
        "list" => {
            $input | each { |value| $value | walk $mapping_fn }
        },
        "table" | "block" | "closure" => { error make {msg: "unimplemented"} },
        _ => { do $mapping_fn $input },
    }
}

# Usage: double all integers in a nested structure
'{data: {values: [1, 2, 3], nested: {values: [4, 5, 6]}}}' | from json
| walk {|value| if ($value | describe) == "int" { $value * 2 } else { $value }}
```

### flatten record-paths — Flatten to Dot-Paths

Flattens a nested record into a list of `{path, value}` pairs with dot-separated keys.

```nu
export def "flatten record-paths" [
    --separator (-s): string = "."  # Separator for chaining paths
] {
    let input = $in
    if ($input | describe) !~ "record" {
        error make {msg: "The record-paths command expects a record"}
    }
    $input | flatten-record-paths $separator
}

def flatten-record-paths [separator: string, ctx?: string] {
    let input = $in
    let primitive = ($input | describe | str replace --regex '<.*' '')

    match $primitive {
        "record" => {
            $input | items { |key, value|
                  let path = if $ctx == null { $key } else { [$ctx $key] | str join $separator }
                  {path: $path, value: $value}
              }
            | reduce -f [] { |row, acc|
                  $acc | append ($row.value | flatten-record-paths $separator $row.path) | flatten
              }
        },
        "list" => {
            $input | enumerate | each { |e|
                  {path: ([$ctx $e.index] | str join $separator), value: $e.item}
              }
        },
        "table" | "block" | "closure" => { error make {msg: "Unexpected type"} },
        _ => { {path: $ctx, value: $input} },
    }
}

# Usage: flatten nested record to dot-paths
'{person: {name: {first: "Alice", last: "Smith"}, age: 30}}' | from json
| flatten record-paths
# → [{path: "person.name.first", value: "Alice"}, ...]

# Custom separator
'{a: {b: {c: null}}}' | from json | flatten record-paths -s "->"
# → [{path: "a->b->c", value: null}]
```

## When to Use DuckDB Instead

For heavy JSON analytics, DuckDB is more appropriate than Nushell:

- **Schema inference**: `read_json()` auto-detects types and builds columns
- **SQL queries**: Complex joins, aggregations, window functions
- **Large datasets**: Streaming processing, Parquet output
- **Date handling**: Auto-casts date-like columns

See the `duckdb` skill for JSON processing with DuckDB.
