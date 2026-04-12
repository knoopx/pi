# Helix Language Configuration

## Language Support Table

| Language   | Highlighting | Textobjects | Auto Indent | Default LSP                                   |
| ---------- | ------------ | ----------- | ----------- | --------------------------------------------- |
| rust       | ✓            | ✓           | ✓           | rust-analyzer                                 |
| javascript | ✓            | ✓           | ✓           | typescript-language-server                    |
| typescript | ✓            | ✓           | ✓           | typescript-language-server                    |
| python     | ✓            | ✓           | ✓           | ty, ruff, pylsp                               |
| go         | ✓            | ✓           | ✓           | gopls                                         |
| java       | ✓            | ✓           | ✓           | jdtls                                         |
| c          | ✓            | ✓           | ✓           | clangd                                        |
| cpp        | ✓            | ✓           | ✓           | clangd                                        |
| lua        | ✓            | ✓           | ✓           | lua-language-server                           |
| nix        | ✓            | ✓           | ✓           | nil, nixd                                     |
| toml       | ✓            | ✓           |             | taplo, tombi                                  |
| yaml       | ✓            | ✓           | ✓           | yaml-language-server                          |
| json       | ✓            | ✓           | ✓           | vscode-json-language-server                   |
| markdown   | ✓            |             |             | marksman, markdown-oxide                      |
| html       | ✓            |             |             | vscode-html-language-server                   |
| css        | ✓            |             | ✓           | vscode-css-language-server                    |
| bash       | ✓            | ✓           | ✓           | bash-language-server                          |
| sql        | ✓            | ✓           |             |                                               |
| dockerfile | ✓            | ✓           |             | docker-langserver                             |
| git-commit | ✓            | ✓           |             |                                               |
| git-rebase | ✓            |             |             |                                               |
| git-ignore | ✓            |             |             |                                               |
| diff       | ✓            |             |             |                                               |
| make       | ✓            |             | ✓           |                                               |
| cmake      | ✓            | ✓           | ✓           | neocmakelsp                                   |
| zig        | ✓            | ✓           | ✓           | zls                                           |
| gleam      | ✓            | ✓           |             | gleam                                         |
| crystal    | ✓            | ✓           | ✓           | crystalline                                   |
| d          | ✓            | ✓           | ✓           | serve-d                                       |
| elixir     | ✓            | ✓           | ✓           | elixir-ls                                     |
| erlang     | ✓            | ✓           |             | erlang_ls                                     |
| fennel     | ✓            |             |             | fennel-ls                                     |
| fish       | ✓            | ✓           | ✓           | fish-lsp                                      |
| fortran    | ✓            |             | ✓           | fortls                                        |
| gdscript   | ✓            | ✓           | ✓           |                                               |
| gleam      | ✓            | ✓           |             | gleam                                         |
| glsl       | ✓            | ✓           | ✓           | glsl_analyzer                                 |
| graphql    | ✓            | ✓           |             | graphql-lsp                                   |
| groovy     | ✓            |             |             |                                               |
| haskell    | ✓            | ✓           |             | haskell-language-server                       |
| hcl        | ✓            | ✓           | ✓           | terraform-ls                                  |
| helm       | ✓            |             |             | helm_ls                                       |
| hocon      | ✓            | ✓           | ✓           |                                               |
| html       | ✓            |             |             | vscode-html-language-server                   |
| hurl       | ✓            | ✓           | ✓           |                                               |
| hyprlang   | ✓            |             | ✓           | hyprls                                        |
| idris      |              |             |             | idris2-lsp                                    |
| inko       | ✓            | ✓           | ✓           |                                               |
| java       | ✓            | ✓           | ✓           | jdtls                                         |
| jq         | ✓            | ✓           |             | jq-lsp                                        |
| jsonnet    | ✓            |             |             | jsonnet-language-server                       |
| julia      | ✓            | ✓           | ✓           | julia                                         |
| just       | ✓            | ✓           | ✓           | just-lsp                                      |
| kdl        | ✓            | ✓           | ✓           |                                               |
| kotlin     | ✓            | ✓           | ✓           | kotlin-language-server                        |
| koto       | ✓            | ✓           | ✓           | koto-ls                                       |
| latex      | ✓            | ✓           |             | texlab                                        |
| ledger     | ✓            |             |             |                                               |
| llvm       | ✓            | ✓           | ✓           |                                               |
| lua        | ✓            | ✓           | ✓           | lua-language-server                           |
| luau       | ✓            | ✓           | ✓           | luau-lsp                                      |
| matlab     | ✓            | ✓           | ✓           |                                               |
| meson      | ✓            |             | ✓           | mesonlsp                                      |
| mint       |              |             |             | mint                                          |
| mojo       | ✓            | ✓           | ✓           | pixi                                          |
| nasm       | ✓            | ✓           |             | asm-lsp                                       |
| nestedtext | ✓            | ✓           | ✓           |                                               |
| nginx      | ✓            |             |             |                                               |
| nickel     | ✓            |             | ✓           | nls                                           |
| nim        | ✓            | ✓           | ✓           | nimlangserver                                 |
| nix        | ✓            | ✓           | ✓           | nil, nixd                                     |
| ocaml      | ✓            |             | ✓           | ocamllsp                                      |
| odin       | ✓            | ✓           | ✓           | ols                                           |
| openscad   | ✓            |             |             | openscad-lsp                                  |
| org        | ✓            |             |             |                                               |
| pascal     | ✓            | ✓           |             | pasls                                         |
| perl       | ✓            | ✓           | ✓           | perlnavigator                                 |
| pest       | ✓            | ✓           | ✓           | pest-language-server                          |
| php        | ✓            | ✓           | ✓           | intelephense                                  |
| pkgbuild   | ✓            | ✓           | ✓           | termux-language-server                        |
| pkl        | ✓            |             | ✓           | pkl-lsp                                       |
| po         | ✓            | ✓           |             |                                               |
| ponylang   | ✓            | ✓           | ✓           |                                               |
| prisma     | ✓            | ✓           |             | prisma-language-server                        |
| prolog     | ✓            |             | ✓           | swipl                                         |
| properties | ✓            | ✓           |             |                                               |
| protobuf   | ✓            | ✓           | ✓           | buf, pb, protols                              |
| prql       | ✓            |             |             |                                               |
| pug        | ✓            |             |             |                                               |
| purescript | ✓            | ✓           |             | purescript-language-server                    |
| python     | ✓            | ✓           | ✓           | ty, ruff, jedi-language-server, pylsp         |
| qml        | ✓            | ✓           | ✓           | qmlls                                         |
| quarto     | ✓            |             | ✓           |                                               |
| r          | ✓            |             |             | R                                             |
| racket     | ✓            |             | ✓           | racket                                        |
| rego       | ✓            |             |             | regols                                        |
| rescript   | ✓            | ✓           |             | rescript-language-server                      |
| robot      | ✓            |             |             | robotframework_ls                             |
| ron        | ✓            |             | ✓           |                                               |
| rst        | ✓            |             |             |                                               |
| ruby       | ✓            | ✓           | ✓           | ruby-lsp, solargraph                          |
| rust       | ✓            | ✓           | ✓           | rust-analyzer                                 |
| scala      | ✓            | ✓           | ✓           | metals                                        |
| scheme     | ✓            |             | ✓           |                                               |
| scss       | ✓            |             |             | vscode-css-language-server                    |
| slang      | ✓            | ✓           | ✓           | slangd                                        |
| slint      | ✓            | ✓           | ✓           | slint-lsp                                     |
| smali      | ✓            |             | ✓           |                                               |
| smithy     | ✓            |             |             | cs                                            |
| snakemake  | ✓            |             | ✓           | pylsp                                         |
| solidity   | ✓            | ✓           |             | solc                                          |
| sourcepawn | ✓            | ✓           |             | sourcepawn-studio                             |
| sql        | ✓            | ✓           |             |                                               |
| starlark   | ✓            | ✓           | ✓           | starpls                                       |
| svelte     | ✓            |             | ✓           | svelteserver                                  |
| sway       | ✓            | ✓           | ✓           | forc                                          |
| swift      | ✓            | ✓           |             | sourcekit-lsp                                 |
| systemd    | ✓            |             |             | systemd-lsp                                   |
| tablegen   | ✓            | ✓           | ✓           |                                               |
| tact       | ✓            | ✓           | ✓           |                                               |
| tcl        | ✓            |             | ✓           |                                               |
| teal       | ✓            |             |             | teal-language-server                          |
| templ      | ✓            |             |             | templ                                         |
| textproto  | ✓            | ✓           | ✓           |                                               |
| tfvars     | ✓            |             | ✓           | terraform-ls                                  |
| thrift     | ✓            |             |             |                                               |
| tlaplus    | ✓            |             |             |                                               |
| todotxt    | ✓            |             |             |                                               |
| toml       | ✓            | ✓           |             | taplo, tombi                                  |
| tsx        | ✓            | ✓           | ✓           | typescript-language-server                    |
| typescript | ✓            | ✓           | ✓           | typescript-language-server                    |
| typespec   | ✓            | ✓           | ✓           | tsp-server                                    |
| typst      | ✓            |             |             | tinymist                                      |
| unison     | ✓            | ✓           | ✓           |                                               |
| v          | ✓            | ✓           | ✓           | v-analyzer                                    |
| vala       | ✓            | ✓           |             | vala-language-server                          |
| verilog    | ✓            | ✓           |             | svlangserver                                  |
| vhdl       | ✓            |             |             | vhdl_ls                                       |
| vhs        | ✓            |             |             |                                               |
| vue        | ✓            |             |             | vue-language-server                           |
| wast       | ✓            |             |             |                                               |
| wat        | ✓            |             |             | wat_server                                    |
| wgsl       | ✓            |             |             | wgsl-analyzer                                 |
| wit        | ✓            |             | ✓           |                                               |
| wren       | ✓            | ✓           | ✓           |                                               |
| xml        | ✓            |             | ✓           |                                               |
| yaml       | ✓            | ✓           | ✓           | yaml-language-server, ansible-language-server |
| yara       | ✓            |             |             | yls                                           |
| zig        | ✓            | ✓           | ✓           | zls                                           |

## Configuring Languages

### Basic Language Entry

```toml
[[language]]
name = "mylang"
scope = "source.mylang"
injection-regex = "mylang"
file-types = ["mylang", "myl"]
comment-tokens = "#"
indent = { tab-width = 2, unit = "  " }
formatter = { command = "mylang-formatter", args = ["--stdin"] }
language-servers = ["mylang-lsp"]
```

### File Type Detection

```toml
file-types = [
  "toml",
  { glob = "Makefile" },
  { glob = ".git/config" },
  { glob = ".github/workflows/*.yaml" }
]
```

Priority: globs → extensions.

### Language Server Config

```toml
[language-server.mylang-lsp]
command = "mylang-lsp"
args = ["--stdio"]
config = { provideFormatter = true }
timeout = 20
environment = { "ENV1" = "value1" }
required-root-patterns = ["*.toml"]

# Format options
[language-server.mylang-lsp.config.format]
semicolons = "insert"
insertSpaceBeforeFunctionParenthesis = true
```

### Multiple Language Servers

```toml
[[language]]
name = "typescript"
language-servers = [
  { name = "efm-lsp-prettier", only-features = ["format"] },
  "typescript-language-server"
]
```

Features: `format`, `goto-definition`, `goto-type-definition`, `goto-reference`, `goto-implementation`, `signature-help`, `hover`, `document-highlight`, `completion`, `code-action`, `workspace-command`, `document-symbols`, `workspace-symbols`, `diagnostics`, `rename-symbol`, `inlay-hints`.

### Tree-sitter Grammar

```toml
[[grammar]]
name = "mylang"
source = {
  git = "https://github.com/example/mylang",
  rev = "a250c4582510ff34767ec3b7dcdd3c24e8c8aa68",
  subpath = "grammars/mylang"  # Optional
}
```

### Selective Grammars

```toml
# Only these grammars
use-grammars = { only = ["rust", "c", "cpp"] }

# Or all except
use-grammars = { except = ["yaml", "json"] }
```

## Adding a Language

1. Add `[[language]]` entry to `languages.toml`
2. Add `[[grammar]]` entry if tree-sitter available
3. Create `runtime/queries/<name>/` directory with:
   - `highlights.scm` - Syntax highlighting
   - `indents.scm` - Auto-indent rules
   - `textobjects.scm` - Textobject queries (optional)
4. Run `cargo xtask docgen` to update docs
5. Run `hx --grammar fetch && hx --grammar build`

## Common Issues

- **Segfault**: Remove `runtime/grammars/<name>.so`
- **Queries not found**: Set `HELIX_RUNTIME` env var
- **LSP not starting**: Check `required-root-patterns`
- **Wrong indent**: Check `indent` config or add `indents.scm`
