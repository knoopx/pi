# Functions

Functions produce replacement values and can only appear on the right-hand side of queries: assignments (`$x = fn()`), insertions (`$x += fn()`), or rewrites (`$x => fn()`).

## Custom Function Definitions

```grit
function lines($string) {
    return split($string, separator=`\n`)
}

// Use the function in a rewrite
`module.exports = $_` as $x => lines(string = $x)
```

Function bodies consist of predicates evaluated in order. The final line must be `return <value>`. Parameters can be positional or named:

```grit
function my_todo($target, $message) {
   if ($message <: undefined) {
       $message = "This requires manual intervention."
   },
   // ... processing logic ...
   return $result
}

// Call with named arguments
my_todo(target=$x, message=`Fix this`)

// Or positional (order must match definition)
my_todo($x, `Fix this`)
```

## Built-in Functions

### String manipulation

| Function     | Signature                             | Example                                    |
| ------------ | ------------------------------------- | ------------------------------------------ |
| `capitalize` | `capitalize(string = $s)`             | `capitalize(string = "hello")` → `"Hello"` |
| `trim`       | `trim(string = $s, trim_chars = " ")` | `trim("  hi  ")` → `"hi"`                  |
| `uppercase`  | `uppercase(string = $s)`              | `uppercase("hello")` → `"HELLO"`           |
| `lowercase`  | `lowercase(string = $s)`              | `lowercase("HELLO")` → `"hello"`           |

### List operations

| Function   | Signature                               | Example                                        |
| ---------- | --------------------------------------- | ---------------------------------------------- |
| `join`     | `join(list = $items, separator = $sep)` | `join(["a","b"], ",")` → `"a,b"`               |
| `split`    | `split(string = $s, separator = $sep)`  | `split("a_b_c", "_")` → `["a","b","c"]`        |
| `shuffle`  | `shuffle(target = $items)`              | `shuffle([1,2,3])` → `[2,3,1]` (deterministic) |
| `distinct` | `distinct(list = $items)`               | `distinct([1,2,1])` → `[1,2]`                  |

### Utility functions

| Function  | Signature                              | Example                                            |
| --------- | -------------------------------------- | -------------------------------------------------- |
| `log`     | `log(message = $msg, variable = $v)`   | Debug logging during rewrite                       |
| `length`  | `length(target = $items \| $s)`        | `length("hello")` → `5`                            |
| `text`    | `text($target)`                        | Capture current text of a node before modification |
| `random`  | `random()` or `random(min=$a, max=$b)` | Pseudorandom; deterministic per run                |
| `resolve` | `resolve(path = $p)`                   | Resolve path relative to current file              |
| `todo`    | `todo(target = $t, message = $m)`      | Mark incomplete transformation with TODO comment   |

### Examples

```grit
// Debug logging
`console.log($arg)` => . where {
  log(message="Processing", variable=$arg)
}

// Accumulate and join strings
$keys += $name,
$new = join(list = $values, separator = ", ")

// Capture original text before modifying
$clone = text($msg),
$msg => `"log", $clone`

// Random values (deterministic across runs)
random()                    // 0-1 float
random(min = 1, max = 10)   // integer 1-10
```

## JavaScript Functions

Functions can be implemented in JavaScript using the `js` keyword:

```grit
language js

function fizzbuzz($x) js {
    const n = parseInt($x.text, 10);
    let out = '';
    if (n % 3 === 0) out += 'Fizz';
    if (n % 5 === 0) out += 'Buzz';
    return out || String(n);
}

`console.log($x)` => fizzbuzz($x)
```

### Limitations

- Must return a string or object with `toString()`
- Executed in a WebAssembly sandbox — no filesystem or network access
- Throw errors → pattern fails to match
- Access parameters only via `$var.text` — non-string metavariables are inaccessible
- Cannot bind new variables; only use passed-in parameters
