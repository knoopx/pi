# Helix Theming Reference

## Using Themes

```toml
# config.toml
theme = "onedark"
```

Or at runtime: `:theme <name>`

## Creating a Theme

Create `~/.config/helix/themes/mytheme.toml`:

```toml
"ui.background" = "#1e1e1e"
"ui.text" = "#d4d4d4"
"keyword" = "#c586c0"
"string" = "#ce9178"

[palette]
black = "#000000"
red = "#f44747"
```

### Syntax

```toml
# Simple color
"keyword" = "#ff0000"

# Full styling
"keyword" = {
  fg = "#ff0000",
  bg = "#000000",
  underline = { color = "#ffff00", style = "curl" },
  modifiers = ["bold", "italic"]
}
```

### Inheritance

```toml
inherits = "onedark"

"keyword" = { fg = "gold" }  # Override

[palette]
berry = "#2A2A4D"  # Override palette
```

## Color Palette

Built-in colors: `default`, `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `gray`, `light-red`, `light-green`, `light-blue`, `light-magenta`, `light-cyan`, `light-gray`, `white`.

## Modifiers

- `bold`
- `dim`
- `italic`
- `underlined` (deprecated, use `underline.style="line"`)
- `slow_blink`
- `rapid_blink`
- `reversed`
- `hidden`
- `crossed_out`

## Underline Styles

- `line`
- `curl`
- `dashed`
- `dotted`
- `double_line`

## Scopes

### Syntax Highlighting

| Scope                           | Description                              |
| ------------------------------- | ---------------------------------------- |
| `attribute`                     | Class attributes, HTML tag attributes    |
| `type`                          | Types                                    |
| `type.builtin`                  | Primitive types (`int`, `usize`)         |
| `type.parameter`                | Generic parameters (`T`)                 |
| `type.enum.variant`             | Enum variants                            |
| `constructor`                   | Constructors                             |
| `constant`                      | Constants                                |
| `constant.builtin`              | `true`, `false`, `nil`                   |
| `constant.builtin.boolean`      | Booleans                                 |
| `constant.character.escape`     | Escape chars                             |
| `constant.numeric`              | Numbers                                  |
| `string`                        | Strings                                  |
| `string.regexp`                 | Regex                                    |
| `string.special.url`            | URLs                                     |
| `string.special.symbol`         | Symbols (Erlang/Elixir atoms)            |
| `comment`                       | Comments                                 |
| `comment.line.documentation`    | Doc comments (`///`)                     |
| `comment.block.documentation`   | Block doc (`/** */`)                     |
| `comment.unused`                | Unused (`_`, `_foo`)                     |
| `variable`                      | Variables                                |
| `variable.builtin`              | `self`, `this`, `super`                  |
| `variable.parameter`            | Function params                          |
| `variable.other.member`         | Struct fields                            |
| `variable.other.member.private` | Private fields (ECMAScript)              |
| `label`                         | `.class`, `#id` in CSS                   |
| `punctuation.delimiter`         | Commas, colons                           |
| `punctuation.bracket`           | Parentheses, brackets                    |
| `punctuation.special`           | String interpolation                     |
| `keyword`                       | Keywords                                 |
| `keyword.control`               | Control flow                             |
| `keyword.control.conditional`   | `if`, `else`                             |
| `keyword.control.repeat`        | `for`, `while`                           |
| `keyword.control.import`        | `import`, `export`                       |
| `keyword.control.return`        | `return`                                 |
| `keyword.control.exception`     | Exception handling                       |
| `keyword.operator`              | `or`, `in`                               |
| `keyword.directive`             | Preprocessor (`#if`)                     |
| `keyword.function`              | `fn`, `func`                             |
| `keyword.storage.type`          | `class`, `function`, `var`, `let`        |
| `keyword.storage.modifier`      | `static`, `mut`, `const`, `ref`          |
| `operator`                      | `+`, `-`, `*`, `/`, `=`, `==`, `+=`, `>` |
| `function`                      | Functions                                |
| `function.builtin`              | Built-in functions                       |
| `function.method.private`       | Private methods                          |
| `function.macro`                | Macros                                   |
| `function.special`              | Preprocessor (C)                         |
| `tag`                           | HTML/XML tags                            |
| `tag.builtin`                   | Built-in tags                            |
| `namespace`                     | Namespaces                               |
| `special`                       | `derive` in Rust                         |
| `markup.heading`                | Headings                                 |
| `markup.heading.marker`         | Heading markers (`#`)                    |
| `markup.heading.1`-`6`          | h1 through h6                            |
| `markup.list`                   | Lists                                    |
| `markup.bold`                   | Bold                                     |
| `markup.italic`                 | Italic                                   |
| `markup.strikethrough`          | Strikethrough                            |
| `markup.link`                   | Links                                    |
| `markup.link.url`               | URLs                                     |
| `markup.link.label`             | Link labels                              |
| `markup.quote`                  | Blockquotes                              |
| `markup.raw`                    | Code blocks                              |
| `diff.plus`                     | Additions                                |
| `diff.plus.gutter`              | Gutter indicator                         |
| `diff.minus`                    | Deletions                                |
| `diff.minus.gutter`             | Gutter indicator                         |
| `diff.delta`                    | Modifications                            |
| `diff.delta.moved`              | Moved files                              |
| `diff.delta.conflict`           | Merge conflicts                          |

### Interface

| Scope                             | Description                    |
| --------------------------------- | ------------------------------ |
| `ui.background`                   | Background                     |
| `ui.text`                         | Default text                   |
| `ui.text.focus`                   | Selected picker line           |
| `ui.cursor`                       | Cursor                         |
| `ui.cursor.normal`                | Normal mode cursor             |
| `ui.cursor.insert`                | Insert mode cursor             |
| `ui.cursor.select`                | Select mode cursor             |
| `ui.cursor.primary`               | Primary selection cursor       |
| `ui.cursor.match`                 | Matching bracket               |
| `ui.gutter`                       | Gutter                         |
| `ui.gutter.selected`              | Selected line gutter           |
| `ui.linenr`                       | Line numbers                   |
| `ui.linenr.selected`              | Selected line number           |
| `ui.statusline`                   | Statusline                     |
| `ui.statusline.inactive`          | Inactive statusline            |
| `ui.statusline.normal`            | Normal mode statusline         |
| `ui.statusline.insert`            | Insert mode statusline         |
| `ui.statusline.select`            | Select mode statusline         |
| `ui.statusline.separator`         | Statusline separator           |
| `ui.bufferline`                   | Buffer line                    |
| `ui.bufferline.active`            | Active buffer                  |
| `ui.window`                       | Split borders                  |
| `ui.help`                         | Help boxes                     |
| `ui.popup`                        | Hover docs                     |
| `ui.popup.info`                   | Key hint boxes                 |
| `ui.picker.header`                | Picker header                  |
| `ui.picker.header.column`         | Column names                   |
| `ui.text.directory`               | Directory names                |
| `ui.virtual.ruler`                | Ruler columns                  |
| `ui.virtual.whitespace`           | Visible whitespace             |
| `ui.virtual.indent-guide`         | Indent guides                  |
| `ui.virtual.inlay-hint`           | Inlay hints                    |
| `ui.virtual.inlay-hint.parameter` | Parameter hints                |
| `ui.virtual.inlay-hint.type`      | Type hints                     |
| `ui.virtual.wrap`                 | Soft-wrap indicator            |
| `ui.virtual.jump-label`           | Jump labels                    |
| `ui.menu`                         | Completion menu                |
| `ui.menu.selected`                | Selected item                  |
| `ui.menu.scroll`                  | Scrollbar (fg=thumb, bg=track) |
| `ui.selection`                    | Selections                     |
| `ui.selection.primary`            | Primary selection              |
| `ui.highlight`                    | Highlighted lines              |
| `ui.highlight.frameline`          | Debug breakpoint line          |
| `ui.cursorline.primary`           | Cursor line (primary)          |
| `ui.cursorline.secondary`         | Cursor line (secondary)        |
| `ui.cursorcolumn.primary`         | Cursor column (primary)        |
| `ui.cursorcolumn.secondary`       | Cursor column (secondary)      |
| `warning`                         | Warning diagnostics (gutter)   |
| `error`                           | Error diagnostics (gutter)     |
| `info`                            | Info diagnostics (gutter)      |
| `hint`                            | Hint diagnostics (gutter)      |
| `diagnostic`                      | Fallback diagnostic (editor)   |
| `diagnostic.hint`                 | Hint diagnostic                |
| `diagnostic.info`                 | Info diagnostic                |
| `diagnostic.warning`              | Warning diagnostic             |
| `diagnostic.error`                | Error diagnostic               |
| `diagnostic.unnecessary`          | Unnecessary code               |
| `diagnostic.deprecated`           | Deprecated code                |
| `tabstop`                         | Snippet placeholder            |
| `ui.debug.breakpoint`             | Breakpoint indicator           |
| `ui.debug.active`                 | Active debug line              |

## Example Theme

```toml
inherits = "base16_default"

"keyword" = "light-red"
"string" = "light-green"
"comment" = { fg = "gray", modifiers = ["italic"] }
"function" = "light-blue"
"type" = "light-cyan"

[palette]
base00 = "#1a1b26"
base05 = "#a9b1d6"
red = "#f7768e"
green = "#9ece6a"
```

## Markup Highlighting (Markdown)

For markdown and similar files, use these scopes:

- `markup.heading.1` - `markup.heading.6` for heading levels
- `markup.link.url` for URLs in links
- `markup.raw.block` for code blocks
- `markup.raw.inline` for inline code
- `markup.quote` for blockquotes
- `markup.list.unnumbered` / `markup.list.numbered` for lists
