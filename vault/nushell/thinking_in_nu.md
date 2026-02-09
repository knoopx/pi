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

- [English](/book/thinking_in_nu.html)
- [中文](/zh-CN/book/thinking_in_nu.html)
- [Deutsch](/de/)
- [Français](/fr/book/thinking_in_nu.html)
- [Español](/es/)
- [日本語](/ja/)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/)
- [한국어](/ko/book/thinking_in_nu.html)

[GitHub](https://github.com/nushell/nushell)

Search`Ctrl``K`

[Get Nu!](/book/installation.html)

[Getting Started](/book/getting_started.html)

DocumentationDocumentation

- [The Nushell Book](/book/)
- [Command Reference](/commands/)
- [Cookbook](/book/cookbook/)
- [Language Reference Guide](/lang-guide/)
- [Contributing Guide](/contributor-book/)

[Blog](/blog/)

LanguagesLanguages

- [English](/book/thinking_in_nu.html)
- [中文](/zh-CN/book/thinking_in_nu.html)
- [Deutsch](/de/)
- [Français](/fr/book/thinking_in_nu.html)
- [Español](/es/)
- [日本語](/ja/)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/)
- [한국어](/ko/book/thinking_in_nu.html)

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

# [Thinking in Nu](#thinking-in-nu)

Nushell is different! It's common (and expected!) for new users to have some existing "habits" or mental models coming from other shells or languages.

The most common questions from new users typically fall into one of the following topics:

- [Nushell isn't Bash](/book/thinking_in_nu.html#nushell-isn-t-bash)
  - [It can sometimes look like Bash](/book/thinking_in_nu.html#it-can-sometimes-look-like-bash)
  - [But it's not Bash](/book/thinking_in_nu.html#but-it-s-not-bash)
- [Implicit Return](/book/thinking_in_nu.html#implicit-return)
- [Single Return Value per Expression](/book/thinking_in_nu.html#single-return-value-per-expression)
- [Every Command Returns a Value](/book/thinking_in_nu.html#every-command-returns-a-value)
- [Think of Nushell as a Compiled Language](/book/thinking_in_nu.html#think-of-nushell-as-a-compiled-language)
  - [Features Built on Static Parsing](/book/thinking_in_nu.html#features-built-on-static-parsing)
  - [Limitations](/book/thinking_in_nu.html#limitations)
  - [Summary](/book/thinking_in_nu.html#summary)
- [Variables are Immutable by Default](/book/thinking_in_nu.html#variables-are-immutable-by-default)
- [Nushell's Environment is Scoped](/book/thinking_in_nu.html#nushell-s-environment-is-scoped)

## [Nushell isn't Bash](#nushell-isn-t-bash)

### [It can sometimes look like Bash](#it-can-sometimes-look-like-bash)

Nushell is both a programming language and a shell. Because of this, it has its own way of working with files, directories, websites, and more. You'll find that some features in Nushell work similar to those you're familiar with in other shells. For instance, pipelines work by combining two (or more) commands together, just like in other shells.

For example, the following commandline works the same in both Bash and Nushell on Unix/Linux platforms:

```
curl -s https://api.github.com/repos/nushell/nushell/contributors | jq -c '.[] | {login,contributions}'
# => returns contributors to Nushell, ordered by number of contributions
```

Nushell has many other similarities with Bash (and other shells) and many commands in common.

Tips

Bash is primarily a command interpreter which runs external commands. Nushell provides many of these as cross-platform, built-in commands.

While the above commandline works in both shells, in Nushell there's just no need to use the `curl` and `jq` commands. Instead, Nushell has a built-in [`http get` command](/commands/docs/http_get.html) and handles JSON data natively. For example:

```
http get https://api.github.com/repos/nushell/nushell/contributors | select login contributions
```

Thinking in Nushell

Nushell borrows concepts from many shells and languages. You'll likely find many of Nushell's features familiar.

### [But it's not Bash](#but-it-s-not-bash)

Because of this, however, it's sometimes easy to forget that some Bash (and POSIX in general) style constructs just won't work in Nushell. For instance, in Bash, it would be normal to write:

```
# Redirect using >
echo "hello" > output.txt
# But compare (greater-than) using the test command
test 4 -gt 7
echo $?
# => 1
```

In Nushell, however, the `>` is used as the greater-than operator for comparisons. This is more in line with modern programming expectations.

```
4 > 10
# => false
```

Since `>` is an operator, redirection to a file in Nushell is handled through a pipeline command that is dedicated to saving content - [`save`](/commands/docs/save.html):

```
"hello" | save output.txt
```

Thinking in Nushell

We've put together a list of common Bash'isms and how to accomplish those tasks in Nushell in the [Coming from Bash](/book/coming_from_bash.html) Chapter.

## [Implicit Return](#implicit-return)

Users coming from other shells will likely be very familiar with the `echo` command. Nushell's [`echo`](/commands/docs/echo.html) might appear the same at first, but it is _very_ different.

First, notice how the following output _looks_ the same in both Bash and Nushell (and even PowerShell and Fish):

```
echo "Hello, World"
# => Hello, World
```

But while the other shells are sending `Hello, World` straight to _standard output_, Nushell's `echo` is simply _returning a value_. Nushell then _renders_ the return value of a command, or more technically, an _expression_.

More importantly, Nushell _implicitly returns_ the value of an expression. This is similar to PowerShell or Rust in many respects.

Tips

An expression can be more than just a pipeline. Even custom commands (similar to functions in many languages, but we'll cover them more in a [later chapter](/book/custom_commands.html)) automatically, implicitly _return_ the last value. There's no need for an `echo` or even a [`return` command](/commands/docs/return.html) to return a value - It just _happens_.

In other words, the string _"Hello, World"_ and the output value from `echo "Hello, World"` are equivalent:

```
"Hello, World" == (echo "Hello, World")
# => true
```

Here's another example with a custom command definition:

```
def latest-file [] {
    ls | sort-by modified | last
}
```

The _output_ of that pipeline (its _"value"_) becomes the _return value_ of the `latest-file` custom command.

Thinking in Nushell

Most anywhere you might write `echo <something>`, in Nushell, you can just write `<something>` instead.

## [Single Return Value per Expression](#single-return-value-per-expression)

It's important to understand that an expression can only return a single value. If there are multiple subexpressions inside an expression, only the **_last_** value is returned.

A common mistake is to write a custom command definition like this:

```
def latest-file [] {
    echo "Returning the last file"
    ls | sort-by modified | last
}

latest-file
```

New users might expect:

- Line 2 to output _"Returning the last file"_
- Line 3 to return/output the file

However, remember that `echo` **_returns a value_**. Since only the last value is returned, the Line 2 _value_ is discarded. Only the file will be returned by line 3.

To make sure the first line is _displayed_, use the [`print` command](/commands/docs/print.html):

```
def latest-file [] {
    print "Returning last file"
    ls | sort-by modified | last
}
```

Also compare:

```
40; 50; 60
```

Tips

A semicolon is the same as a newline in a Nushell expression. The above is the same as a file or multi-line command:

```
40
50
60
```

or

```
echo 40
echo 50
echo 60
```

In all of the above:

- The first value is evaluated as the integer 40 but is not returned
- The second value is evaluated as the integer 50 but is not returned
- The third value is evaluated as the integer 60, and since it is the last value, it is is returned and displayed (rendered).

Thinking in Nushell

When debugging unexpected results, be on the lookout for:

- Subexpressions (e.g., commands or pipelines) that ...
- ... output a (non-`null`) value ...
- ... where that value isn't returned from the parent expression.

These can be likely sources of issues in your code.

## [Every Command Returns a Value](#every-command-returns-a-value)

Some languages have the concept of "statements" which don't return values. Nushell does not.

In Nushell, **_every command returns a value_**, even if that value is `null` (the `nothing` type). Consider the following multiline expression:

```
let p = 7
print $p
$p * 6
```

1. Line 1: The integer 7 is assigned to `$p`, but the return value of the [`let` command](/commands/docs/let.html) itself is `null`. However, because it is not the last value in the expression, it is not displayed.
2. Line 2: The return value of the `print` command itself is `null`, but the `print` command forces its argument (`$p`, which is 7) to be _displayed_. As with Line 1, the `null` return value is discarded since this isn't the last value in the expression.
3. Line 3: Evaluates to the integer value 42. As the last value in the expression, this is the return result, and is also displayed (rendered).

Thinking in Nushell

Becoming familiar with the output types of common commands will help you understand how to combine simple commands together to achieve complex results.

`help <command>` will show the signature, including the output type(s), for each command in Nushell.

## [Think of Nushell as a Compiled Language](#think-of-nushell-as-a-compiled-language)

In Nushell, there are exactly two, separate, high-level stages when running code:

1. _Stage 1 (Parser):_ Parse the **_entire_** source code
2. _Stage 2 (Engine):_ Evaluate the **_entire_** source code

It can be useful to think of Nushell's parsing stage as _compilation_ in [static](/book/how_nushell_code_gets_run.html#dynamic-vs-static-languages) languages like Rust or C++. By this, we mean that all of the code that will be evaluated in Stage 2 must be **_known and available_** during the parsing stage.

Important

However, this also means that Nushell cannot currently support an `eval` construct as with _dynamic_ languages such as Bash or Python.

### [Features Built on Static Parsing](#features-built-on-static-parsing)

On the other hand, the **_static_** results of Parsing are key to many features of Nushell its REPL, such as:

- Accurate and expressive error messages
- Semantic analysis for earlier and robust detection of error conditions
- IDE integration
- The type system
- The module system
- Completions
- Custom command argument parsing
- Syntax highlighting
- Real-time error highlighting
- Profiling and debugging commands
- (Future) Formatting
- (Future) Saving IR (Intermediate Representation) "compiled" results for faster execution

### [Limitations](#limitations)

The static nature of Nushell often leads to confusion for users coming to Nushell from languages where an `eval` is available.

Consider a simple two-line file:

```
<line1 code>
<line2 code>
```

1. Parsing:
   1. Line 1 is parsed
   2. Line 2 is parsed
2. If parsing was successful, then Evaluation:
   1. Line 1 is evaluated
   2. Line 2 is evaluated

This helps demonstrate why the following examples cannot run as a single expression (e.g., a script) in Nushell:

Note

The following examples use the [`source` command](/commands/docs/source.html), but similar conclusions apply to other commands that parse Nushell source code, such as [`use`](/commands/docs/use.html), [`overlay use`](/commands/docs/overlay_use.html), [`hide`](/commands/docs/hide.html) or [`source-env`](/commands/docs/source-env.html).

#### [Example: Dynamically Generating Source](#example-dynamically-generating-source)

Consider this scenario:

```
"print Hello" | save output.nu
source output.nu
# => Error: nu::parser::sourced_file_not_found
# =>
# =>   × File not found
# =>    ╭─[entry #5:2:8]
# =>  1 │ "print Hello" | save output.nu
# =>  2 │ source output.nu
# =>    ·        ────┬────
# =>    ·            ╰── File not found: output.nu
# =>    ╰────
# =>   help: sourced files need to be available before your script is run
```

This is problematic because:

1. Line 1 is parsed but not evaluated. In other words, `output.nu` is not created during the parsing stage, but only during evaluation.
2. Line 2 is parsed. Because `source` is a parser-keyword, resolution of the sourced file is attempted during Parsing (Stage 1). But `output.nu` doesn't even exist yet! If it _does_ exist, then it's probably not even the correct file! This results in the error.

Note

Typing these as two _separate_ lines in the **_REPL_** will work since the first line will be parsed and evaluated, then the second line will be parsed and evaluated.

The limitation only occurs when both are parsed _together_ as a single expression, which could be part of a script, block, closure, or other expression.

See the [REPL](/book/how_nushell_code_gets_run.html#the-nushell-repl) section in _"How Nushell Code Gets Run"_ for more explanation.

#### [Example: Dynamically Creating a Filename to be Sourced](#example-dynamically-creating-a-filename-to-be-sourced)

Another common scenario when coming from another shell might be attempting to dynamically create a filename that will be sourced:

```
let my_path = "~/nushell-files"
source $"($my_path)/common.nu"
# => Error:
# =>   × Error: nu::shell::not_a_constant
# =>   │
# =>   │   × Not a constant.
# =>   │    ╭─[entry #6:2:11]
# =>   │  1 │ let my_path = "~/nushell-files"
# =>   │  2 │ source $"($my_path)/common.nu"
# =>   │    ·           ────┬───
# =>   │    ·               ╰── Value is not a parse-time constant
# =>   │    ╰────
# =>   │   help: Only a subset of expressions are allowed constants during parsing. Try using the 'const' command or typing the value literally.
# =>   │
# =>    ╭─[entry #6:2:8]
# =>  1 │ let my_path = "~/nushell-files"
# =>  2 │ source $"($my_path)/common.nu"
# =>   ·        ───────────┬───────────
#   ·                   ╰── Encountered error during parse-time evaluation
#   ╰────
```

Because the `let` assignment is not resolved until evaluation, the parser-keyword `source` will fail during parsing if passed a variable.

Comparing Rust and C++

Imagine that the code above was written in a typical compiled language such as C++:

```
#include <string>

std::string my_path("foo");
#include <my_path + "/common.h">
```

or Rust

```
let my_path = "foo";
use format!("{}::common", my_path);
```

If you've ever written a simple program in any of these languages, you can see these examples aren't valid in those languages. Like Nushell, compiled languages require that all of the source code files are ready and available to the compiler beforehand.

See Also

As noted in the error message, however, this can work if `my_path` can be defined as a [constant](/book/variables#constant-variables) since constants can be (and are) resolved during parsing.

```
const my_path = "~/nushell-files"
source $"($my_path)/common.nu"
```

See [Parse-time Constant Evaluation](/book/how_nushell_code_gets_run.html#parse-time-constant-evaluation) for more details.

#### [Example: Change to a different directory (`cd`) and `source` a file](#example-change-to-a-different-directory-cd-and-source-a-file)

Here's one more — Change to a different directory and then attempt to `source` a file in that directory.

```
if ('spam/foo.nu' | path exists) {
    cd spam
    source-env foo.nu
}
```

Based on what we've covered about Nushell's Parse/Eval stages, see if you can spot the problem with that example.

Solution

In line 3, during Parsing, the `source-env` attempts to parse `foo.nu`. However, `cd` doesn't occur until Evaluation. This results in a parse-time error, since the file is not found in the _current_ directory.

To resolve this, of course, simply use the full-path to the file to be sourced.

```
    source-env spam/foo.nu
```

### [Summary](#summary)

Important

For a more in-depth explanation of this section, see [How Nushell Code Gets Run](/book/how_nushell_code_gets_run.html).

Thinking in Nushell

Nushell is designed to use a single Parsing stage for each expression or file. This Parsing stage occurs before and is separate from Evaluation. While this enables many of Nushell's features, it also means that users need to understand the limitations it creates.

## [Variables are Immutable by Default](#variables-are-immutable-by-default)

Another common surprise when coming from other languages is that Nushell variables are immutable by default. While Nushell has optional mutable variables, many of Nushell's commands are based on a functional-style of programming which requires immutability.

Immutable variables are also key to Nushell's [`par-each` command](/commands/docs/par-each.html), which allows you to operate on multiple values in parallel using threads.

See [Immutable Variables](/book/variables.html#immutable-variables) and [Choosing between mutable and immutable variables](/book/variables.html#choosing-between-mutable-and-immutable-variables) for more information.

Thinking in Nushell

If you're used to relying on mutable variables, it may take some time to relearn how to code in a more functional style. Nushell has many functional features and commands that operate on and with immutable variables. Learning them will help you write code in a more Nushell-idiomatic style.

A nice bonus is the performance increase you can realize by running parts of your code in parallel with `par-each`.

## [Nushell's Environment is Scoped](#nushell-s-environment-is-scoped)

Nushell takes multiple design cues from compiled languages. One such cue is that languages should avoid global mutable state. Shells have commonly used global mutation to update the environment, but Nushell attempts to steer clear of this approach.

In Nushell, blocks control their own environment. Changes to the environment are scoped to the block where they occur.

In practice, this lets you write (as just one example) more concise code for working with subdirectories. Here's an example that builds each sub-project in the current directory:

```
ls | each { |row|
  cd $row.name
  make
}
```

The [`cd`](/commands/docs/cd.html) command changes the `PWD` environment variables, but this variable change does not survive past the end of the block. This allows each iteration to start from the current directory and then enter the next subdirectory.

Having a scoped environment makes commands more predictable, easier to read, and when the time comes, easier to debug. It's also another feature that is key to the `par-each` command we discussed above.

Nushell also provides helper commands like [`load-env`](/commands/docs/load-env.html) as a convenient way of loading multiple updates to the environment at once.

See Also

[Environment - Scoping](/book/environment.html#scoping)

Note

[`def --env`](/commands/docs/def.html) is an exception to this rule. It allows you to create a command that changes the parent's environment.

Thinking in Nushell

Use scoped-environment to write more concise scripts and prevent unnecessary or unwanted global environment mutation.

[Edit this page on GitHub](https://github.com/nushell/nushell.github.io/edit/main/book/thinking_in_nu.md)

Contributors: JT, jntrnr, rgwood, Reilly Wood, Fernando Herrera, Evan Platzer, Justin Ma, Jonas Gollenz, Jakub Žádník, HoLLy, Leon, Joel Afriyie, Hofer-Julian, Alpha Chen, Máté FARKAS, Stefan Holderbach, Mate Farkas, Jan Klass, arnau, Trent-Fellbootman, ysthakur, fdncred, Wind, Ian Manske, sophiajt, NotTheDr01ds, Bruce Weirdan, jesper-olsen, Wouter Overmeire, Kai Welke, Gisle Aas
