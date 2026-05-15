# String Operations

Nushell provides a rich set of string manipulation commands under the `str` namespace. These are used extensively for cleaning and transforming text data in tabular pipelines.

## Case Conversion

```nu
# Convert to uppercase
open data.csv | update name { |x| $x | str upcase }

# Convert to lowercase
open data.csv | update name { |x| $x | str downcase }

# Capitalize first letter of each word
open data.csv | update name { |x| $x | str capitalize }

# Title case (capitalize first letter of each word)
open data.csv | update name { |x| $x | str title-case }

# camelCase, PascalCase, kebab-case, snake_case, SCREAMING_SNAKE_CASE
open data.csv | update slug { |x| $x | str kebab-case }
open data.csv | update name { |x| $x | str snake-case }
open data.csv | update name { |x| $x | str camel-case }
```

## Trimming and Whitespace

```nu
# Trim leading and trailing whitespace
open data.csv | update date { |x| $x | str trim }

# Trim specific characters
open data.csv | update field { |x| $x | str trim " \t\r\n" }
```

## Length and Position

```nu
# String length
$my_string | str length

# Find substring index (-1 if not found)
$my_string | str index-of "pattern"

# Substring extraction (start_index, length)
$my_string | str substring 0 5          # First 5 characters
$my_string | str substring 3            # From position 3 to end
```

## Search and Match

### `str contains` — Partial Substring Match

Requires `each/where` pattern for filtering rows by partial match:

```nu
# Filter rows where column contains a substring
open "data.csv"
| each { |row| if ($row.Address | str contains "Barcelona") { $row } else { null } }
| where $it != null

# Multiple conditions chain
open "data.csv"
| each { |row| if ($row.Address | str contains "Barcelona") { $row } else { null } }
| where $it != null
| each { |row| if ($row.Description | str contains "restaurant") { $row } else { null } }
| where $it != null

# Filter short descriptions
open "Favorite Places.csv"
| each { |row| if ($row.Description | str length) < 100 { $row } else { null } }
| where $it != null
| select Title Description
```

### Regex Pattern Matching in `where`

Use the `=~` (match) and `!~` (exclude) operators directly:

```nu
# Include rows matching pattern
open data.csv | where Title =~ "FPV"

# Exclude rows matching pattern
open data.csv | where Title !~ "FPV"

# Combined with other conditions
open data.csv | where status == "active" and Title =~ "FPV"
```

### `parse` with Regex Patterns

For complex extraction, use `parse --regex` with named capture groups:

```nu
# Named captures: (?P<name>...)
^cargo search shells --limit 5 | lines
| each { |line| $line | parse --regex '(?P<name>.+) = "(?P<version>.+)" +# (?P<desc>.+)' }
| flatten

# Conditional regex (handle different formats)
^cargo search shells --limit 5 | lines
| each { |line|
    if ($line | str contains "#") {
        $line | parse --regex '(?P<name>.+) = "(?P<version>.+)" +# (?P<description>.+)'
    } else {
        $line | parse --regex '(?P<name>.+) = "(?P<version>.+)"'
    }
  }
| flatten
```

## Replace and Transform

### `str replace` — Find and Replace Text

```nu
# Simple replacement (first occurrence)
$my_string | str replace "old" "new"

# Replace in a column
open data.csv | update url { |x| $x | str replace "http://" "https://" }
```

### `str join` — Concatenate with Separator

```nu
# Join list of strings
["a" "b" "c"] | str join ", "
# => a, b, c

# Join from table column values
open data.csv | get tags | str join ", "

# Join with custom separator (useful for building query strings)
let labels = ["feature" "bug" "docs"]
$labels | str join "+"
```

### `str distance` — Edit Distance / Levenshtein

```nu
# Compare two strings and return the edit distance
"hello" | str distance "hallo"
# => 1 (one character difference)
```

## String Expansion

```nu
# Generate all brace expansion combinations
"file_{a,b,c}.txt" | str expand
# => [file_a.txt, file_b.txt, file_c.txt]
```

## Special Characters

```nu
# Output special characters
char nl            # Newline
char tab           # Tab
char cr            # Carriage return

# Escape regex special characters in a string
my_pattern | str escape-regex
```

## String Filtering Patterns for Tabular Data

### Filter by Description Length

```nu
# Find entries with descriptions under 100 chars
open "data.csv"
| each { |row| if ($row.Description | str length) < 100 { $row } else { null } }
| where $it != null
| select Title Description
```

### Filter by Multiple Substring Conditions

```nu
# Chain multiple str contains filters
open "data.csv"
| each { |row| if ($row.Address | str contains "Barcelona") { $row } else { null } }
| where $it != null
| each { |row| if ($row.Description | str contains "restaurant") { $row } else { null } }
| where $it != null
```

### Exclude Pattern + Length Filter

```nu
# Combine regex exclusion with string length filter
open "data.csv"
| where Title !~ "FPV"
| each { |row| if ($row.Description | str length) < 150 { $row } else { null } }
| where $it != null
```

## Numeric Filtering from String Columns

When numeric values are stored as strings (e.g., ratings, prices), convert to float for comparison:

```nu
# Convert string ratings to floats for comparison
open "data.csv"
| where Rating != ""                           # Filter empties first
| each { |r| { ...$r, Rating_num: ($r.Rating | into float) } }
| where Rating_num > 4.0
| select Title Rating_num
```

## String Formatting in Closures

When using string interpolation inside closures (e.g., `each`, `update`):

```nu
# Use $row.field references for clarity (avoid $in inside each blocks)
open data.csv | each { |row| { ...$row, label: $"($row.name) - ($row.category)" } }

# Use single-letter aliases for brevity in simple transforms
open data.csv | each { |r| { ...$r, total: ($r.price * $r.qty) } }
```
