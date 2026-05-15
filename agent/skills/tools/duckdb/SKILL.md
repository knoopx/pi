---
name: duckdb
description: "Process JSON with DuckDB — schema inference, SQL queries, complex joins, and streaming. Use when Nushell pipelines aren't enough for JSON analytics."
token_cost: 200
related: [nu, kuva]
keywords: ["duckdb", "json", "sql", "schema", "query", "analytics"]
---

# DuckDB JSON Processing

DuckDB excels at JSON analytics: schema inference, SQL queries, complex joins, and streaming. Use when Nushell pipeline commands aren't enough.

## Loading JSON

### read_json — Auto-Detect Schema

Reads JSON files or URLs, auto-detects structure into typed columns. Arrays and objects become [composite types](https://duckdb.org/docs/sql/data_types/overview.html#nested--composite-types).

```sql
-- Load from URL or file
select * from read_json('https://api.example.com/data');
select * from read_json('data.json');

-- In-memory (no .db file)
duckdb :memory:
```

Date-like columns auto-cast to `timestamp`. Use explicit schema for control:

```sql
-- Explicit column types
select * from read_json('films.json', columns = {
  title: varchar, release_date: date, created: timestamp
});

-- Cast specific columns
select title, created::datetime from read_json('films.json');
```

### Unstructured JSON Mode

Returns raw JSON blobs instead of auto-detected columns:

```sql
-- Single column of JSON blobs
select json_data from read_json('data.json',
  format = 'unstructured', columns = {json_data: 'json[]'});

-- Unfold into rows
select unnest(json_data) as raw from read_json('data.json',
  format = 'unstructured', columns = {json_data: 'json[]'});
```

## Inspecting JSON Structure

### json_structure — Schema Detection

Returns the inferred schema of a JSON blob:

```sql
select json_structure(raw_data) from my_table limit 1;
-- {"title":"VARCHAR","episode_id":"UBIGINT",...}
```

Use with `from_json` for type conversion:

```sql
set variable json_schema = (select json_structure(raw_data) from my_table limit 1);
select from_json(raw_data, getvariable('json_schema')) as typed from my_table;
```

### json_keys — Top-Level Keys

```sql
select unnest(json_keys(raw_data)) as keys from my_table limit 1;
```

### unnest — Struct to Columns

Converts a struct into actual columns:

```sql
select unnest(from_json(raw_data, getvariable('json_schema'))) as row from my_table;
```

## Extracting Values

### json_extract (`->`) and json_extract_string (`->>`)

```sql
select
  raw_data->>'title' as title,
  (raw_data->>'episode_id')::uint64 as episode_id,
  (raw_data->'characters')::varchar[] as characters
from my_table;

-- Equivalent function form
select json_extract_string(raw_data, 'title') as title from my_table;
```

### Unfolding Arrays into Rows

```sql
select
  json_extract_string(raw_data, 'title') as title,
  unnest(cast(json_extract(raw_data, 'characters') as varchar[])) as character_id
from my_table;
```

**Warning**: Using `unnest` on two different columns zips them by position. Normalize one table at a time.

## Creating JSON

### Struct Literal Syntax

Compose nested structures with `{ key: value }` syntax:

```sql
select {
  type: 'character',
  name: character.name,
  homeworld: { type: 'planet', name: planet.name, climate: planet.climate },
  species: species.name
} as character
from character
join planet on planet.url = character.homeworld
left join species on species.url = character.species[1];
```

### array_agg — Fold Values into Arrays

Inverse of `unnest` — groups rows back into arrays:

```sql
select
  { type: 'film', title: title, characters: array_agg(character_blob) } as film
from film_character
join character_blob on character_blob.url = film_character.character
group by film_character.url, film_character.title;
```

### to_json — Cast to JSON String

```sql
select to_json(film_struct) as film_json from film_blob;
-- json() and json_string() are equivalent
```

## Writing JSON

### copy — Export JSON

```sql
-- Line-delimited JSON (default)
copy film to 'output.ndjson';

-- JSON array
copy film to 'output.json' (format json, array true);
```

## Streaming JSON

Process JSON without intermediate files:

```sh
# stdin → transform → stdout
echo '[{"a":1,"b":[2,3]}]' | duckdb -json -c \
  "select a, unnest(b) as b from read_json('/dev/stdin')"

# Database → stdout
duckdb -c "copy (select title, unnest(characters) from film) to '/dev/stdout' (format json, array true)" db.db
```

## Key Functions Reference

| Function                      | Purpose                                |
| ----------------------------- | -------------------------------------- |
| `read_json()`                 | Load JSON file or URL with auto-schema |
| `json_structure()`            | Infer schema from JSON blob            |
| `json_keys()`                 | List top-level keys                    |
| `json_extract` (`->`)         | Extract value as JSON                  |
| `json_extract_string` (`->>`) | Extract value as string                |
| `from_json()`                 | Transform JSON to native type          |
| `to_json()`                   | Cast native type to JSON               |
| `unnest()`                    | Unfold array into rows                 |
| `array_agg()`                 | Fold rows into array                   |

## Resources

- [DuckDB JSON Documentation](https://duckdb.org/docs/data/json/overview)
- [MotherDuck: Analyze JSON with SQL](https://motherduck.com/blog/analyze-json-data-using-sql/)
- [DuckDB Blog: Shredding Nested JSON](https://duckdb.org/2023/03/03/json.html)
- [Wrangling JSON with DuckDB](https://bnm3k.github.io/blog/wrangling-json-with-duckdb/)
