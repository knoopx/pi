# Custom Commands (def)

Custom commands are like functions but act as first-class Nushell commands — they integrate with the help system, pipelines, and parser for real-time type checking.

## Basic Definition

```nu
def greet [name] {
    $"Hello, ($name)!"
}

greet "World"                    # => Hello, World!
greet --help                     # Show auto-generated help
```

The block is the command body. The last expression is implicitly returned (no `return` needed).

## Returning Values

### Implicit Return

The final expression's value is the return value:

```nu
def eight [] {
    1 + 1
    2 + 2
    4 + 4                         # => returns 8
}

eight | describe                  # => int
```

### Suppressing Output

Use `ignore` when the command should act as a statement (no return):

```nu
def create-three-files [] {
    [ file1 file2 file3 ] | each {|filename| touch $filename } | ignore
}
```

Or return `null` explicitly.

### Early Return

Use the `return` keyword to exit early:

```nu
def process-list [] {
    let input_length = length
    if $input_length > 10_000 {
        print "Input list is too long"
        return null
    }
    $in | each {|i| $i * 4.25 }
}
```

## Pipeline I/O

### Output (Streaming)

Custom commands can stream output:

```nu
def my-ls [] { ls }
my-ls | get name                 # Works — output streams row by row
```

### Input

Commands accept pipeline input via `$in`:

```nu
def double [] {
    each {|num| 2 * $num }       # Implicitly receives $in
}

[1 2 3] | double                 # => [2, 4, 6]
```

Store input for later use:

```nu
def nullify [...cols] {
    let start = $in
    $cols | reduce --fold $start {|col, table|
        $table | upsert $col null
    }
}

ls | nullify name size           # Sets specified columns to null
```

## Parameters

### Required Positional Parameters

Default — must be provided:

```nu
def greet [name1 name2] {
    $"Hello, ($name1) and ($name2)!"
}

greet Wei Mei                    # => Hello, Wei and Mei!
greet Wei                        # Error: missing required positional argument
```

### Optional Positional Parameters

Add `?` after the parameter name:

```nu
def greet [name?: string] {
    $"Hello, ($name | default 'You')"
}

greet                            # => Hello, You
greet Alice                      # => Hello, Alice
```

Optional parameters are `null` when not provided — use `default` or `match`.

### Default Values

Provide a default directly (also makes the parameter optional):

```nu
def greet [name = "Nushell"] {
    $"Hello, ($name)!"
}

greet                            # => Hello, Nushell!
greet world                      # => Hello, World!
```

### Type Annotations

Annotate parameters for parser-time type checking:

```nu
def greet [name: string]         # Only accepts strings
def inc [n: int]: int -> int { $n + 1 }   # Also declare input/output types

greet "World"                    # Works
inc "hello"                      # Parser error: expected int, got string
```

Available type annotations: `any`, `binary`, `bool`, `cell-path`, `closure`, `datetime`, `duration`, `filesize`, `float`, `glob`, `int`, `list`, `nothing`, `range`, `record`, `string`, `table`. Special types: `number` (int or float), `path`, `directory`.

### Flags

Named parameters with `--`:

```nu
def greet [
    name: string
    --age: int                   # Optional flag
] {
    { name: $name, age: $age }
}

greet Lucia --age 23             # => {name: Lucia, age: 23}
greet World                      # => {name: World, age: null}
```

Flags can go before or after positional parameters. Use `-a` shorthand:

```nu
def greet [
    name: string
    --age (-a): int
] { { name: $name, age: $age } }

greet Akosua -a 35               # => {name: Akosua, age: 35}
```

Boolean switches (true when present):

```nu
def greet [
    name: string
    --caps                       # Boolean switch
] {
    let greeting = $"Hello, ($name)!"
    if $caps { $greeting | str upcase } else { $greeting }
}

greet Miguel --caps              # => HELLO, MIGUEL!
greet Chukwuemeka                # => Hello, Chukwuemeka!
```

Enable/disable switches: `--caps=true`, `--caps=false`.

### Rest Parameters

Collect unlimited positional arguments with `...`:

```nu
def multi-greet [...names: string] {
    for $name in $names {
        print $"Hello, ($name)!"
    }
}

multi-greet Elin Lars Erik       # => Hello Elin!, Hello Lars!, Hello Erik!
```

Combine with positional parameters (required first):

```nu
def vip-greet [vip: string, ...names: string] {
    for $name in $names { print $"Hello, ($name)!" }
    print $"And a special welcome to our VIP today, ($vip)!"
}

vip-greet Rahul Priya Arjun      # VIP = Rahul, names = [Priya, Arjun]
```

Spread operator `...` passes list elements as individual arguments:

```nu
let guests = [ Dwayne Shanice Jerome ]
vip-greet $vip ...$guests
```

## Wrapping External Commands

Use `def --wrapped` to collect unknown flags/args into a rest parameter, then forward them:

```nu
def --wrapped ezal [...rest] {
    eza -l --icons ...$rest      # Always use long listing with icons
}

ezal commands                    # → eza -l --icons commands
ezal -d commands                 # → eza -l --icons -d commands
```

## Input/Output Type Signatures

Narrow the allowed pipeline input and output types:

```nu
def "str stats" []: string -> record { }    # Only accepts strings, returns records

# Multiple supported input/output type combinations
def "str join" [separator?: string]: [
    list -> string
    string -> string
] { }
```

Commands that don't accept input or produce output use `nothing`:

```nu
def xhide [module: string]: nothing -> nothing { }
```

Signatures are enforced at parse time — invalid pipeline chains and type mismatches are caught before execution.

## Documenting Commands

Add comments before `def` for help text:

```nu
# Greet guests along with a VIP
#
# Use for birthdays, graduation parties,
# retirements, and any other event.
def vip-greet [
    vip: string        # The special guest
    ...names: string   # The other guests
] {
    for $name in $names { print $"Hello, ($name)!" }
    print $"Welcome, ($vip)!"
}

help vip-greet         # Shows description and parameter docs
```

Use `@attr` annotations before `def`:

```nu
# Greet guests along with a VIP
@example "Greet a VIP" { vip-greet "Bob" } --result "Welcome, Bob!"
@deprecated "Use vip-greet as a replacement."
@category "greetings"
def greet [name: string] { $"Hello, ($name)!" }
```

## Environment Side Effects

By default, custom commands are scoped — environment changes don't leak out. Use `def --env` to modify the caller's environment:

```nu
def foo [] { $env.FOO = 'After' }       # Scoped: no effect outside
$env.FOO = "Before"; foo; $env.FOO      # => Before

def --env bar [] { $env.FOO = 'After' } # --env: changes propagate
$env.FOO = "Before"; bar; $env.FOO      # => After
```

Same for `cd` — use `def --env cd-home [] { cd ~ }` to change directories from within a command.

## Persisting Commands

Make commands available across sessions by adding them to `config.nu`, sourcing files, or importing modules (see [references/modules.md](references/modules.md)).
