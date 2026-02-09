[Nushell](/)

[Get Nu!](/book/installation.html)

[Getting Started](/book/getting_started.html)

DocumentationDocumentation

- [The Nushell Book](/book/)
- [Command Reference](/commands/)
- [Cookbook](/cookbook/)
- [Language Reference Guide](/lang-guide/)
- [Contributing Guide](/contributor-book/)

[Blog](/blog/)

LanguagesLanguages

- [English](/book/types_of_data.html)
- [中文](/zh-CN/book/types_of_data.html)
- [Deutsch](/de/book/types_of_data.html)
- [Français](/fr/)
- [Español](/es/)
- [日本語](/ja/book/types_of_data.html)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/)
- [한국어](/ko/book/types_of_data.html)

[GitHub](https://github.com/nushell/nushell)

Search`Ctrl``K`

[Get Nu!](/book/installation.html)

[Getting Started](/book/getting_started.html)

DocumentationDocumentation

- [The Nushell Book](/book/)
- [Command Reference](/commands/)
- [Cookbook](/cookbook/)
- [Language Reference Guide](/lang-guide/)
- [Contributing Guide](/contributor-book/)

[Blog](/blog/)

LanguagesLanguages

- [English](/book/types_of_data.html)
- [中文](/zh-CN/book/types_of_data.html)
- [Deutsch](/de/book/types_of_data.html)
- [Français](/fr/)
- [Español](/es/)
- [日本語](/ja/book/types_of_data.html)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/)
- [한국어](/ko/book/types_of_data.html)

[GitHub](https://github.com/nushell/nushell)

- [Introduction](/book/)
- [Installation](/book/installation.html)
  - [Default Shell](/book/default_shell.html)
- [Getting Started](/book/getting_started.html)
  - [Quick Tour](/book/quick_tour.html)
  - [Moving Around the System](/book/moving_around.html)
  - [Thinking in Nu](/book/thinking_in_nu.html)
  - [Nushell Cheat Sheet](/book/cheat_sheet.html)
- [Nu Fundamentals](/book/nu_fundamentals.html)
  - [Types of Data](/book/types_of_data.html)
  - [Loading Data](/book/loading_data.html)
  - [Pipelines](/book/pipelines.html)
  - [Working with Strings](/book/working_with_strings.html)
  - [Working with Lists](/book/working_with_lists.html)
  - [Working with Records](/book/working_with_records.html)
  - [Working with Tables](/book/working_with_tables.html)
  - [Navigating and Accessing Structured Data](/book/navigating_structured_data.html)
  - [Special Variables](/book/special_variables.html)
- [Programming in Nu](/book/programming_in_nu.html)
  - [Custom Commands](/book/custom_commands.html)
  - [Aliases](/book/aliases.html)
  - [Operators](/book/operators.html)
  - [Variables](/book/variables.html)
  - [Control Flow](/book/control_flow.html)
  - [Scripts](/book/scripts.html)
  - [Modules](/book/modules.html)
    - [Using Modules](/book/modules/using_modules.html)
    - [Creating Modules](/book/modules/creating_modules.html)
  - [Overlays](/book/overlays.html)
  - [Sorting](/book/sorting.html)
  - [Testing your Nushell Code](/book/testing.html)
  - [Best Practices](/book/style_guide.html)
- [Nu as a Shell](/book/nu_as_a_shell.html)
  - [Configuration](/book/configuration.html)
  - [Environment](/book/environment.html)
  - [Stdout, Stderr, and Exit Codes](/book/stdout_stderr_exit_codes.html)
  - [Running System (External) Commands](/book/running_externals.html)
  - [How to Configure 3rd Party Prompts](/book/3rdpartyprompts.html)
  - [Directory Stack](/book/directory_stack.html)
  - [Reedline, Nu's Line Editor](/book/line_editor.html)
  - [Custom Completions](/book/custom_completions.html)
  - [Externs](/book/externs.html)
  - [Coloring and Theming in Nu](/book/coloring_and_theming.html)
  - [Hooks](/book/hooks.html)
  - [Background Jobs](/book/background_jobs.html)
- [Coming to Nu](/book/coming_to_nu.html)
  - [Coming from Bash](/book/coming_from_bash.html)
  - [Coming from CMD.EXE](/book/coming_from_cmd.html)
  - [Coming from PowerShell](/book/coming_from_powershell.html)
  - [Nu map from other shells and domain specific languages](/book/nushell_map.html)
  - [Nu Map from Imperative Languages](/book/nushell_map_imperative.html)
  - [Nu Map from Functional Languages](/book/nushell_map_functional.html)
  - [Nushell operator map](/book/nushell_operator_map.html)
- [Design Notes](/book/design_notes.html)
  - [How Nushell Code Gets Run](/book/how_nushell_code_gets_run.html)
- [(Not So) Advanced](/book/advanced.html)
  - [Standard Library (Preview)](/book/standard_library.html)
  - [Dataframes](/book/dataframes.html)
  - [Metadata](/book/metadata.html)
  - [Creating Your Own Errors](/book/creating_errors.html)
  - [Parallelism](/book/parallelism.html)
  - [Plugins](/book/plugins.html)
  - [explore](/book/explore.html)

# [Types of Data](#types-of-data)

Traditional Unix shell commands communicate with each other using strings of text -- One command writes text to standard output (often abbreviated `stdout`) and the other reads text from standard input (or `stdin`). This allows multiple commands to be combined together to communicate through what is called a "pipeline".

Nushell embraces this approach and expands it to include other types of data in addition to strings.

Like many programming languages, Nu models data using a set of simple, structured data types. Simple data types include integers, floats, strings, and booleans. There are also special types for dates, file sizes, and time durations.

The [`describe`](/commands/docs/describe.html) command returns the type of a data value:

```
42 | describe
# => int
```

## [Types at a Glance](#types-at-a-glance)

| Type                                  | Example                                                               |
| ------------------------------------- | --------------------------------------------------------------------- | --- | ------ | ----------------------------- | -------------- |
| [Integers](#integers)                 | `-65535`                                                              |
| [Floats (decimals)](#floats-decimals) | `9.9999`, `Infinity`                                                  |
| [Strings](#text-strings)              | ``"hole 18", 'hole 18', `hole 18`, hole18, r#'hole18'#``              |
| [Booleans](#booleans)                 | `true`                                                                |
| [Dates](#dates)                       | `2000-01-01`                                                          |
| [Durations](#durations)               | `2min + 12sec`                                                        |
| [File-sizes](#file-sizes)             | `64mb`                                                                |
| [Ranges](#ranges)                     | `0..4`, `0..<5`, `0..`, `..4`                                         |
| [Binary](#binary-data)                | `0x[FE FF]`                                                           |
| [Lists](#lists)                       | `[0 1 'two' 3]`                                                       |
| [Records](#records)                   | `{name:"Nushell", lang: "Rust"}`                                      |
| [Tables](#tables)                     | `[{x:12, y:15}, {x:8, y:9}]`, `[[x, y]; [12, 15], [8, 9]]`            |
| [Closures](#closures)                 | `{                                                                    | e   | $e + 1 | into string }`, `{ $in.name.0 | path exists }` |
| [Cell-paths](#cell-paths)             | `$.name.0`                                                            |
| [Blocks](#blocks)                     | `if true { print "hello!" }`, `loop { print "press ctrl-c to exit" }` |
| [Null (Nothing)](#nothing-null)       | `null`                                                                |
| [Any](#any)                           | `let p: any = 5`                                                      |

## [Basic Data Types](#basic-data-types)

### [Integers](#integers)

|                       |                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **_Description:_**    | Numbers without a fractional component (positive, negative, and 0)                                                                                        |
| **_Annotation:_**     | `int`                                                                                                                                                     |
| **_Literal Syntax:_** | A decimal, hex, octal, or binary numeric value without a decimal place. E.g., `-100`, `0`, `50`, `+50`, `0xff` (hex), `0o234` (octal), `0b10101` (binary) |
| **_See also:_**       | [Language Reference - Integer](/lang-guide/chapters/types/basic_types/int.html)                                                                           |

Simple Example:

```
10 / 2
# => 5
5 | describe
# => int
```

### [Floats/Decimals](#floats-decimals)

|                       |                                                                                  |
| --------------------- | -------------------------------------------------------------------------------- |
| **_Description:_**    | Numbers with some fractional component                                           |
| **_Annotation:_**     | `float`                                                                          |
| **_Literal Syntax:_** | A decimal numeric value including a decimal place. E.g., `1.5`, `2.0`, `-15.333` |
| **_See also:_**       | [Language Reference - Float](/lang-guide/chapters/types/basic_types/float.html)  |

Simple Example:

```
2.5 / 5.0
# => 0.5
```

Tips

As in most programming languages, decimal values in Nushell are approximate.

```
10.2 * 5.1
# => 52.01999999999999
```

### [Text/Strings](#text-strings)

|                       |                                                                                   |
| --------------------- | --------------------------------------------------------------------------------- |
| **_Description:_**    | A series of characters that represents text                                       |
| **_Annotation:_**     | `string`                                                                          |
| **_Literal Syntax:_** | See [Working with strings](/book/working_with_strings.html)                       |
| **_See also:_**       | [Handling Strings](/book/loading_data.html#handling-strings)                      |
|                       | [Language Reference - String](/lang-guide/chapters/types/basic_types/string.html) |

As with many languages, Nushell provides multiple ways to specify String values and numerous commands for working with strings.

Simple (obligatory) example:

```
let audience: string = "World"
$"Hello, ($audience)"
# => Hello, World
```

### [Booleans](#booleans)

|                       |                                                                                  |
| --------------------- | -------------------------------------------------------------------------------- |
| **_Description:_**    | True or False value                                                              |
| **_Annotation:_**     | `bool`                                                                           |
| **_Literal Syntax:_** | Either a literal `true` or `false`                                               |
| **_See also:_**       | [Language Reference - Boolean](/lang-guide/chapters/types/basic_types/bool.html) |

Booleans are commonly the result of a comparison. For example:

```
let mybool: bool = (2 > 1)
$mybool
# => true
let mybool: bool = ($env.HOME | path exists)
$mybool
# => true
```

A boolean result is commonly used to control the flow of execution:

```
let num = -2
if $num < 0 { print "It's negative" }
# => It's negative
```

### [Dates](#dates)

| | |
| **_Description:_** | Represents a specific point in time using international standard date-time descriptors |
| **_Annotation:_** | `datetime` |
| **_Literal Syntax:_** | See [Language Guide - Date](/lang-guide/chapters/types/basic_types/datetime.html) |

Simple example:

```
date now
# => Mon, 12 Aug 2024 13:59:22 -0400 (now)
# Format as Unix epoch
date now | format date '%s'
# => 1723485562
```

### [Durations](#durations)

|                       |                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **_Description:_**    | Represent a unit of a passage of time                                                     |
| **_Annotation:_**     | `duration`                                                                                |
| **_Literal Syntax:_** | See [Language Reference - Duration](/lang-guide/chapters/types/basic_types/duration.html) |

Durations support fractional values as well as calculations.

Simple example:

```
3.14day
# => 3day 3hr 21min
30day / 1sec  # How many seconds in 30 days?
# => 2592000
```

### [File sizes](#file-sizes)

|                       |                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **_Description:_**    | Specialized numeric type to represent the size of files or a number of bytes              |
| **_Annotation:_**     | `filesize`                                                                                |
| **_Literal Syntax:_** | See [Language Reference - Filesize](/lang-guide/chapters/types/basic_types/filesize.html) |

Nushell also has a special type for file sizes.

As with durations, Nushell supports fractional file sizes and calculations:

```
0.5kB
# => 500 B
1GiB / 1B
# => 1073741824
(1GiB / 1B) == 2 ** 30
# => true
```

See the [Language Reference](/lang-guide/chapters/types/basic_types/filesize.html) for a complete list of units and more detail.

### [Ranges](#ranges)

|                       |                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **_Description:_**    | Describes a range of values from a starting value to an ending value, with an optional stride. |
| **_Annotation:_**     | `range`                                                                                        |
| **_Literal Syntax:_** | `<start_value>..<end_value>`. E.g., `1..10`.                                                   |
|                       | `<start_value>..<second_value>..<end_value>`. E.g., `2..4..20`                                 |
| **_See also:_**       | [Language Guide - Range](/lang-guide/chapters/types/basic_types/range.html)                    |

Simple example:

```
1..5
# => ╭───┬───╮
# => │ 0 │ 1 │
# => │ 1 │ 2 │
# => │ 2 │ 3 │
# => │ 3 │ 4 │
# => │ 4 │ 5 │
# => ╰───┴───╯
```

Tips

You can also easily create lists of characters with a form similar to ranges with the command [`seq char`](/commands/docs/seq_char.html) as well as with dates using the [`seq date`](/commands/docs/seq_date.html) command.

### [Cell Paths](#cell-paths)

|                       |                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **_Description:_**    | An expression that is used to navigate to an inner value in a structured value.                                 |
| **_Annotation:_**     | `cell-path`                                                                                                     |
| **_Literal syntax:_** | A dot-separated list of row (int) and column (string) IDs. E.g., `name.4.5`.                                    |
|                       | Optionally, use a leading `$.` when needed for disambiguation, such as when assigning a cell-path to a variable |
| **_See also:_**       | [Language Reference - Cell-path](/lang-guide/chapters/types/basic_types/cellpath.html)                          |
|                       | [Navigating and Accessing Structured Data](/book/navigating_structured_data.html) chapter.                      |

Simple example:

```
let cp = $.2
# Return list item at index 2
[ foo bar goo glue ] | get $cp
# => goo
```

### [Closures](#closures)

|                       |                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- |
| **_Description:_**    | An anonymous function, often called a lambda function, which accepts parameters and _closes over_ (i.e., uses) variables from outside its scope |
| **_Annotation:_**     | `closure`                                                                                                                                       |
| **_Literal Syntax:_** | `{                                                                                                                                              | args | expressions }` |
| **_See also:_**       | [Language Reference - Closure](/lang-guide/chapters/types/basic_types/closure.html)                                                             |

Simple example:

This closure returns a boolean result of the comparison and then uses it in a `where` command to return all values greater than 5.

```
let compare_closure = {|a| $a > 5 }
let original_list = [ 40 -4 0 8 12 16 -16 ]
$original_list | where $compare_closure
# => ╭───┬────╮
# => │ 0 │ 40 │
# => │ 1 │  8 │
# => │ 2 │ 12 │
# => │ 3 │ 16 │
# => ╰───┴────╯
```

Closures are a useful way to represent code that can be executed on each row of data via [filters](/lang-guide/chapters/filters/00_filters_overview.html)

### [Binary data](#binary-data)

|                       |                                                                               |
| --------------------- | ----------------------------------------------------------------------------- |
| **_Description:_**    | Represents binary data                                                        |
| **_Annotation:_**     | `binary`                                                                      |
| **_Literal Syntax:_** | `0x[ffffffff]` - hex-based binary representation                              |
|                       | `0o[1234567]` - octal-based binary representation                             |
|                       | `0b[10101010101]` - binary-based binary representation                        |
| **_See also:_**       | [Language Guide - Binary](/lang-guide/chapters/types/basic_types/binary.html) |

Binary data, like the data from an image file, is a group of raw bytes.

Simple example - Confirm that a JPEG file starts with the proper identifier:

```
open nushell_logo.jpg
| into binary
| first 2
| $in == 0x[ff d8]
# => true
```

## [Structured Data Types](#structured-data-types)

Nushell includes a collection of structured data types that can contain the primitive types above. For example, instead of a single `float`, structured data gives us a way to represent multiple `float` values, such as a `list` of temperature readings, in the same value. Nushell supports the following structured data types:

### [Lists](#lists)

|                       |                                                                                   |
| --------------------- | --------------------------------------------------------------------------------- |
| **_Description:_**    | Ordered sequence of zero or more values of any type                               |
| **_Annotation:_**     | `list`                                                                            |
| **_Literal Syntax:_** | See [Language Guide - List](/lang-guide/chapters/types/basic_types/list.html)     |
| **_See Also:_**       | [Working with Lists](/book/working_with_lists.html)                               |
|                       | [Navigating and Accessing Structured Data](/book/navigating_structured_data.html) |

Simple example:

```
[Sam Fred George]
# => ╭───┬────────╮
# => │ 0 │ Sam    │
# => │ 1 │ Fred   │
# => │ 2 │ George │
# => ╰───┴────────╯
```

### [Records](#records)

|                       |                                                                                   |
| --------------------- | --------------------------------------------------------------------------------- |
| **_Description:_**    | Holds key-value pairs which associate string keys with various data values.       |
| **_Annotation:_**     | `record`                                                                          |
| **_Literal Syntax:_** | See [Language Guide - Record](/lang-guide/chapters/types/basic_types/record.html) |
| **_See Also:_**       | [Working with Records](/book/working_with_records.html)                           |
|                       | [Navigating and Accessing Structured Data](/book/navigating_structured_data.html) |

Simple example:

```
let my_record = {
  name: "Kylian"
  rank: 99
}
$my_record
# => ╭───────┬────────────╮
# => │ name  │ Kylian     │
# => │ rank  │ 99         │
# => ╰───────┴────────────╯

$my_record | get name
# =>  Kylian
```

### [Tables](#tables)

|                    |                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **_Description:_** | A two-dimensional container with both columns and rows where each cell can hold any basic or structured data type |
| **_Annotation:_**  | `table`                                                                                                           |
| **_See Also:_**    | [Working with Tables](/book/working_with_tables.html)                                                             |
|                    | [Navigating and Accessing Structured Data](/book/navigating_structured_data.html)                                 |
|                    | [Language Guide - Table](/lang-guide/chapters/types/basic_types/table.html)                                       |

The table is a core data structure in Nushell. As you run commands, you'll see that many of them return tables as output. A table has both rows and columns.

Tips

Internally, tables are simply **lists of records**. This means that any command which extracts or isolates a specific row of a table will produce a record. For example, `get 0`, when used on a list, extracts the first value. But when used on a table (a list of records), it extracts a record:

```
[{x:12, y:5}, {x:3, y:6}] | get 0
# => ╭───┬────╮
# => │ x │ 12 │
# => │ y │ 5  │
# => ╰───┴────╯
```

## [Other Data Types](#other-data-types)

### [Any](#any)

|                       |                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| **_Description:_**    | When used in a type annotation or signature, matches any type. In other words, a "superset" of other types. |
| **_Annotation:_**     | `any`                                                                                                       |
| **_Literal syntax:_** | N/A - Any literal value can be assigned to an `any` type                                                    |
| **_See also:_**       | [Language Reference - Any](/lang-guide/chapters/types/basic_types/any.html)                                 |

### [Blocks](#blocks)

|                       |                                                                                 |
| --------------------- | ------------------------------------------------------------------------------- |
| **_Description:_**    | A syntactic form used by some Nushell keywords (e.g., `if` and `for`)           |
| **_Annotation:_**     | N/A                                                                             |
| **_Literal Syntax:_** | N/A                                                                             |
| **_See also:_**       | [Language Reference - Block](/lang-guide/chapters/types/other_types/block.html) |

Simple example:

```
if true { print "It's true" }
```

The `{ print "It's true" }` portion above is a block.

### [Nothing (Null)](#nothing-null)

|                       |                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------- |
| **_Description:_**    | The `nothing` type is to be used to represent the absence of another value.         |
| **_Annotation:_**     | `nothing`                                                                           |
| **_Literal Syntax:_** | `null`                                                                              |
| **_See also:_**       | [Language Reference - Nothing](/lang-guide/chapters/types/basic_types/nothing.html) |

#### [Simple Example](#simple-example)

Using the optional operator `?` returns `null` if the requested cell-path doesn't exist:

```
let simple_record = { a: 5, b: 10 }
$simple_record.a?
# => 5
$simple_record.c?
# => Nothing is output
$simple_record.c? | describe
# => nothing
$simple_record.c? == null
# => true
```

[Edit this page on GitHub](https://github.com/nushell/nushell.github.io/edit/main/book/types_of_data.md)

Contributors: Carson Black, Ibraheem Ahmed, Maximilian Roos, Eoin Kelly, Jonathan Turner, LyesSaadi, JT, sholderbach, Fawad Halim, prrao87, Benjamin Kane, stormasm, Reilly Wood, rgwood, Fernando Herrera, jntrnr, Justin Ma, Aadam Zocolo, merkrafter, merelymyself, Stefan Holderbach, fdncred, Joshua Jolley, Jakub Žádník, Christer Jensen, Dan Davison, Andrey, Leon, Tomochika Hara, Hofer-Julian, Máté FARKAS, Mate Farkas, amtoine, Damian Carrillo, hanjunghyuk, Charles, Trent-Fellbootman, ysthakur, TWSiO, KITAGAWA Yasutaka, Ian Manske, NotTheDr01ds, yo-goto, 0x4D5352, joshuanussbaum, link1183, Jan Klass, gert7
