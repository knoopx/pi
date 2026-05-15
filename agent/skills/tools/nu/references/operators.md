# Operators

Nushell supports arithmetic, comparison, logical, pattern matching, bitwise, and spread operators.

## Arithmetic Operators

| Operator | Description    | Example    | Result            |
| -------- | -------------- | ---------- | ----------------- |
| `+`      | Addition       | `3 + 5`    | `8`               |
| `-`      | Subtraction    | `10 - 4`   | `6`               |
| `*`      | Multiplication | `3 * 7`    | `21`              |
| `/`      | Division       | `10 / 3`   | `3.33...` (float) |
| `//`     | Floor division | `10 // 3`  | `3` (int)         |
| `mod`    | Modulo         | `10 mod 3` | `1`               |
| `**`     | Exponentiation | `2 ** 10`  | `1024`            |

Operations preserve types where possible: int / int = float, filesize + filesize = filesize, duration + duration = duration.

```nu
5 + 3                       # => 8
10.5 - 2.3                  # => 8.2 (float)
64mb + 32mb                 # => 96mb (filesize)
3day + 12hr                 # => 3day 12hr (duration)
10 // 3                     # => 3 (floor division)
10 mod 3                    # => 1
2 ** 8                      # => 256
```

## Comparison Operators

| Operator | Description   | Example  | Result |
| -------- | ------------- | -------- | ------ |
| `==`     | Equal         | `5 == 5` | `true` |
| `!=`     | Not equal     | `5 != 3` | `true` |
| `<`      | Less than     | `3 < 5`  | `true` |
| `>`      | Greater than  | `5 > 3`  | `true` |
| `<=`     | Less or equal | `5 <= 5` | `true` |
| `>=`     | Greater or eq | `5 >= 4` | `true` |

Comparisons work across compatible types: numbers vs numbers, strings vs strings, datetimes vs datetimes, file sizes vs file sizes, durations vs durations.

```nu
"apple" == "apple"          # => true
"banana" > "apple"          # => true (lexicographic)
2024-01-01 < 2024-06-01     # => true
64mb >= 32mb                # => true
```

## Pattern Matching Operators

| Operator      | Description     | Example                      | Result |
| ------------- | --------------- | ---------------------------- | ------ |
| `=~`          | Regex match     | `"hello" =~ "^h.*o$"`        | `true` |
| `!~`          | Not regex match | `"world" !~ "^h"`            | `true` |
| `in`          | Member of       | `"b" in ["a", "b", "c"]`     | `true` |
| `not-in`      | Not member of   | `"d" not-in ["a", "b", "c"]` | `true` |
| `has`         | Contains value  | `[1 2 3] has 2`              | `true` |
| `starts-with` | Prefix check    | `"hello" starts-with "he"`   | `true` |
| `ends-with`   | Suffix check    | `"hello" ends-with "lo"`     | `true` |

```nu
# Regex matching (in where clauses, for example)
open data.csv | where name =~ "^A.*"       # Names starting with A
open data.csv | where description !~ "FPV" # Exclude FPV entries

# Membership testing
if "active" in $statuses { print "Found it" }
$my_list has 42                            # => bool

# Prefix/suffix checks
$file starts-with "/etc/"                  # => bool
$name ends-with ".json"                    # => bool
```

## Logical Operators

| Operator | Description | Example          | Result  |
| -------- | ----------- | ---------------- | ------- |
| `and`    | Logical AND | `true and false` | `false` |
| `or`     | Logical OR  | `true or false`  | `true`  |

```nu
open data.csv | where status == "active" and rating > 4.0
open data.csv | where category == "electronics" or category == "books"
```

## Bitwise Operators

Nushell uses explicit function-style names for bitwise operations:

| Operator  | Description | Example       | Result |
| --------- | ----------- | ------------- | ------ |
| `bit-and` | AND         | `5 bit-and 3` | `1`    |
| `bit-or`  | OR          | `5 bit-or 3`  | `7`    |
| `bit-xor` | XOR         | `5 bit-xor 3` | `6`    |
| `bit-shl` | Shift left  | `1 bit-shl 3` | `8`    |
| `bit-shr` | Shift right | `8 bit-shr 2` | `2`    |

```nu
5 bit-and 3     # Binary: 101 & 011 = 001 => 1
5 bit-or 3      # Binary: 101 | 011 = 111 => 7
5 bit-xor 3     # Binary: 101 ^ 011 = 110 => 6
```

## Spread Operator (`...`)

Expand lists, records, or tables inline:

```nu
# Spread a list into a new list
let x = [1 2]
[ ...$x 3 ]                       # => [1, 2, 3]

# Spread in record construction
let base = { name: "Sam", rank: 10 }
{ ...$base, title: "Mayor" }      # => {name: Sam, rank: 10, title: Mayor}

# Spread a table into append
$data | append ...$other_data     # Same as $data | append $other_data (flattened)

# Spread arguments to rest parameters in custom commands
let guests = [ Dwayne Shanice ]
vip-greet "VIP" ...$guests        # Expands list elements as individual args
```

## String Concatenation (`++`)

The `++` operator concatenates strings, lists, and tables:

```nu
"hello" ++ " " ++ "world"         # => "hello world" (string concat)

[1 2] ++ [3 4]                    # => [1, 2, 3, 4] (list concat)
$table | append $other_table      # Same as $table ++ $other_table (row stacking)
```

## Assignment Operators

For mutable variables only (`mut`):

| Operator | Description         | Equivalent to      |
| -------- | ------------------- | ------------------ |
| `=`      | Assign              | `$x = 5`           |
| `+=`     | Add and assign      | `$x = $x + 1`      |
| `-=`     | Subtract and assign | `$x = $x - 1`      |
| `*=`     | Multiply and assign | `$x = $x * 2`      |
| `/=`     | Divide and assign   | `$x = $x / 2`      |
| `++=`    | Append and assign   | `$x = $x ++ [new]` |

```nu
mut counter = 0
$counter += 1                     # => 1
$counter -= 5                     # => -4
$counter *= 2                     # => -8
let items = [1]; mut nums = $items; $nums ++= [2]   # => [1, 2]
```

## Operator Precedence

From lowest to highest binding:

1. `or`
2. `and`
3. `=~`, `!~`, `starts-with`, `ends-with`, `in`, `not-in`, `has`
4. `==`, `!=`, `<`, `>`, `<=`, `>=`
5. `+`, `-`
6. `*`, `/`, `//`, `mod`
7. `**`

Use parentheses to override: `(2 + 3) * 4` → `20`.
