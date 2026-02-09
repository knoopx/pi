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

- [English](/)
- [中文](/zh-CN/)
- [Deutsch](/de/)
- [Français](/fr/)
- [Español](/es/)
- [日本語](/ja/)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/)
- [한국어](/ko/)

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

- [English](/)
- [中文](/zh-CN/)
- [Deutsch](/de/)
- [Français](/fr/)
- [Español](/es/)
- [日本語](/ja/)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/)
- [한국어](/ko/)

[GitHub](https://github.com/nushell/nushell)

# Nushell

A new type of shell

## Cross-platform

Nu works on Linux, macOS, BSD, and Windows. Learn it once, then use it anywhere.

## Everything is data

Nu pipelines use structured data so you can safely select, filter, and sort the same way every time. Stop parsing strings and start solving problems.

## Powerful plugins

It's easy to extend Nu using a powerful plugin system.

![Screenshot showing using the ls command](https://www.nushell.sh/frontpage/ls-example.png)

### [Nu works with existing data](#nu-works-with-existing-data)

Nu speaks [JSON, YAML, SQLite, Excel, and more](/book/loading_data.html) out of the box. It's easy to bring data into a Nu pipeline whether it's in a file, a database, or a web API:

![Screenshot showing fetch with a web API](https://www.nushell.sh/frontpage/fetch-example.png)

### [Nu has great error messages](#nu-has-great-error-messages)

Nu operates on typed data, so it catches bugs that other shells don't. And when things break, Nu tells you exactly where and why:

![Screenshot showing Nu catching a type error](https://www.nushell.sh/frontpage/miette-example.png)

## [Get Nu](#get-nu)

Nushell is available as [downloadable binaries](https://github.com/nushell/nushell/releases), [via your favourite package manager](https://repology.org/project/nushell/versions), in [a GitHub Action](https://github.com/marketplace/actions/setup-nu), and as [source code](https://github.com/nushell/nushell). Read [the detailed installation instructions](/book/installation.html) or dive right in:

#### [macOS / Linux:](#macos-linux)

##### [Homebrew](#homebrew)

```
$ brew install nushell
```

##### [Nix profile](#nix-profile)

```
$ nix profile install nixpkgs#nushell
```

#### [Windows:](#windows)

```
# Install to user scope (by default).
winget install nushell
# Machine scope installation (Run as admin).
winget install nushell --scope machine
```

After installing, launch Nu by typing `nu`.

## [Documentation](#documentation)

- [Getting Started](/book/getting_started.html) guides you through getting familiar with Nushell
- [Coming to Nu](/book/coming_to_nu.html) describes similarities and differences to other languages and shells
- [Nu Fundamentals](/book/nu_fundamentals.html) is a more elaborate and structured description of the fundamentals
- [Programming in Nu](/book/programming_in_nu.html) describes Nu as a programming language
- [Nu as a Shell](/book/nu_as_a_shell.html) gives you insight into interactive functionality and configurability in a shell environment

## [Community](#community)

Join us [on Discord](https://discord.gg/NtAbbGn) if you have any questions about Nu!

You can help improve this site by [giving us feedback](https://github.com/nushell/nushell.github.io/issues) or [sending a PR](https://github.com/nushell/nushell.github.io/pulls).
