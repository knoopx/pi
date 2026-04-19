# Parsing Files and Formats

Nushell can read many data formats directly via the `open` command (auto-detected from extension) or explicitly via `from <format>` commands.

## Supported File Formats for `open`

- **csv, tsv** — CSV/TSV delimited files
- **json** — JSON objects and arrays
- **yaml / yml** — YAML documents
- **xml** — XML documents
- **toml** — TOML configuration files
- **ini** — INI configuration files
- **xlsx / xls** — Excel spreadsheets
- **ods** — OpenDocument spreadsheet files
- **ssv** — Space-separated values
- **eml, ics, vcf** — Email/calendar/contact formats
- **url** — URL-encoded data

```nu
open data.csv                # CSV → table
open data.json               # JSON → record or list
open config.yaml             # YAML → record
open schema.toml             # TOML → record
open spreadsheet.xlsx        # Excel → table(s)
```

## NUON (Nushell Object Notation)

NUON is a superset of JSON — any valid JSON is valid NUON. It is "human-friendly": comments are allowed, commas are not required.

```nu
# This is valid NUON (from default_config.nu):
{
  menus: [
    {
      name: completion_menu
      only_buffer_difference: false
      marker: "| "
      type: { layout: columnar, columns: 4 }
      style: { text: green, selected_text: green_reverse }
    }
  ]
}
```

Limitation: NUON cannot represent blocks (closures).

## Opening in Raw Mode

Use `--raw` to read without parsing:

```nu
open README.md --raw         # Raw text string instead of parsed table
open Cargo.lock              # Auto-detected as TOML from extension
open raw_data.txt            # If extension is unknown, treat as raw string
```

## Explicit Format Parsing with `from`

When a file has no recognized extension, use `from <format>`:

```nu
# Parse content as a specific format
open Cargo.lock | from toml    # File without .toml extension
"Some JSON" | from json        # String → parsed value
"Some YAML" | from yaml        # String → parsed record

# Convert TO formats
$table | to json               # Table → JSON string
$data | save output.csv        # Write as CSV (auto-detected)
```

## CSV Parsing Options (`from csv`)

```nu
# Basic usage
"col1,col2\n1,2" | from csv

# Custom separator
open data.txt | from csv --separator "\t"    # Tab-separated
open data.txt | from csv --separator ";"     # Semicolon-separated

# Handle variable column counts
open data.csv | from csv --flexible          # Allow different column counts

# Skip header row (first row is data)
open data.csv | from csv --noheaders         # Then use `headers` to name columns

# Ignore comment lines
open data.csv | from csv --comment "#"       # Lines starting with # are skipped

# Trim whitespace
open data.csv | from csv --trim all          # Trim headers and values
open data.csv | from csv --trim headers      # Trim only headers
open data.csv | from csv --trim fields       # Trim only values

# Quote/escape handling (defaults handle most cases)
open data.csv | from csv --quote '"'         # Handles "field,with,commas"
```

## Space-Separated Values (`from ssv`)

For parsing command output like `df`, `ls -l`, etc.:

```nu
# Aligned columns with minimum spacing
df -h | str replace "Mounted on" Mounted_On | from ssv --aligned-columns --minimum-spaces 1

# Adjust minimum spaces between columns (default is 2)
ps aux | from ssv --minimum-spaces 3
```

## Auto-Detect Columns (`detect columns`)

More forgiving than `from ssv`; auto-detects where columns begin and end:

```nu
df -h | detect columns
ls -l /usr/bin/ | detect columns

# Combine with str replace for headers with spaces
df -h | str replace "Mounted on" Mounted_On | detect columns
```

## Headers Command

Convert a file without headers into a proper table:

```nu
# From CSV lines (noheader mode)
open data.csv | lines | from csv --noheaders | headers

# From split column output
open data.txt | lines | split column ":" | headers
```

## Parse — Extract Columns from String Patterns

### Brace Pattern Syntax (Most Common)

```nu
# Simple named fields
"red,green,blue" | split row "," | each { |item| $item | parse "{name}" }

# Multi-field extraction
^cargo search shells --limit 10 | lines
| parse "{crate_name} = {version} #{description}"
| str trim
```

### Regex Pattern (`--regex` flag)

Named capture groups use `(?P<name>...)` syntax:

```nu
# Named captures for flexible extraction
^cargo search shells --limit 10 | lines
| each { |line| $line | parse --regex '(?P<name>.+) = "(?P<version>.+)" +# (?P<desc>.+)' }
| flatten

# Conditional parsing for different formats
^command output | lines
| each { |line|
    if ($line | str contains "#") {
        $line | parse --regex '(?P<name>.+) = "(?P<version>.+)" +# (?P<desc>.+)'
    } else {
        $line | parse --regex '(?P<name>.+) = "(?P<version>.+)"'
    }
  }
| flatten
```

## Split Commands

```nu
# Split a string into a list of values
"red,green,blue" | split row ","            # → ["red", "green", "blue"]

# Split a column into multiple columns
open data.csv | get notes | lines | split column ":" Name Details

# Split into characters
'aeiou' | split chars                        # → [a, e, i, o, u]

# Use with lines to process multi-line text
rg -c Value | lines | split column ":" file line_count | into int line_count
```

## Lines Command

Convert input to individual lines:

```nu
# Split raw text into lines array
open data.csv --raw | lines
open data.txt --raw | lines | from csv       # Lines → parse as CSV

# Process command output
^df -h | str replace "Mounted on" Mounted_On | detect columns
```

## SQLite Databases

SQLite databases are auto-detected by `open`, regardless of extension:

```nu
# Open entire database
open foo.db

# Get a specific table
open foo.db | get some_table

# Run SQL queries
open foo.db | query db "select * from some_table"
```

## Fetching URLs (`http get`)

Load data from the internet:

```nu
http get https://example.com/data.json          # JSON → record/list
http get https://api.example.com/users.csv      # CSV → table
http get https://blog.rust-lang.org/feed.xml    # XML → structured data
```

## File Writing (`save` / `to`)

| Output Format | Command                            | Notes                                  |
| ------------- | ---------------------------------- | -------------------------------------- |
| CSV (default) | `save output.csv`                  | Auto-detected from extension           |
| TSV           | `save output.tsv --separator "\t"` | Specify tab separator                  |
| JSON          | `to json \| save output.json`      | Add `--pretty` for formatted output    |
| YAML          | `save output.yaml`                 | Auto-detected                          |
| NUON          | `to nuon \| save output.nu`        | Human-friendly format                  |
| Append        | `save --append data.csv`           | Append to existing file                |
| In-place      | `collect \| save --force file.csv` | Required for overwriting the same file |
