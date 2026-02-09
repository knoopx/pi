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

- [English](/book/installation.html)
- [中文](/zh-CN/book/installation.html)
- [Deutsch](/de/book/installation.html)
- [Français](/fr/book/installation.html)
- [Español](/es/)
- [日本語](/ja/book/installation.html)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/book/installation.html)
- [한국어](/ko/book/installation.html)

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

- [English](/book/installation.html)
- [中文](/zh-CN/book/installation.html)
- [Deutsch](/de/book/installation.html)
- [Français](/fr/book/installation.html)
- [Español](/es/)
- [日本語](/ja/book/installation.html)
- [Português do Brasil](/pt-BR/)
- [Русский язык](/ru/book/installation.html)
- [한국어](/ko/book/installation.html)

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

# [Installing Nu](#installing-nu)

There are lots of ways to get Nu up and running. You can download pre-built binaries from our [release page](https://github.com/nushell/nushell/releases), [use your favourite package manager](https://repology.org/project/nushell/versions), or build from source.

The main Nushell binary is named `nu` (or `nu.exe` on Windows). After installation, you can launch it by typing `nu`.

```
$ nu
/home/sophiajt/Source>
```

- [Pre-built Binaries](/book/installation.html#pre-built-binaries)
- [Package Managers](/book/installation.html#package-managers)
- [Docker Container Images](/book/installation.html#docker-container-images)
- [Build from Source](/book/installation.html#build-from-source)
  - [Installing a Compiler Suite](/book/installation.html#installing-a-compiler-suite)
  - [Installing Rust](/book/installation.html#installing-rust)
  - [Dependencies](/book/installation.html#dependencies)
  - [Build from crates.io using Cargo](/book/installation.html#build-from-crates-io-using-cargo)
  - [Building from the GitHub repository](/book/installation.html#building-from-the-github-repository)

## [Pre-built Binaries](#pre-built-binaries)

Nu binaries are published for Linux, macOS, and Windows [with each GitHub release](https://github.com/nushell/nushell/releases). Just download, extract the binaries, then copy them to a location on your PATH.

## [Package Managers](#package-managers)

Nu is available via several package managers:

[![Packaging status](https://repology.org/badge/vertical-allrepos/nushell.svg)](https://repology.org/project/nushell/versions)

For macOS and Linux, [Homebrew](https://brew.sh/) is a popular choice (`brew install nushell`).

For Windows:

- [Winget](https://docs.microsoft.com/en-us/windows/package-manager/winget/)
  - Machine scope installation: `winget install nushell --scope machine`
  - Machine scope upgrade: `winget update nushell`
  - User scope installation: `winget install nushell` or `winget install nushell --scope user`
  - User scope upgrade: Due to [winget-cli issue #3011](https://github.com/microsoft/winget-cli/issues/3011), running `winget update nushell` will unexpectedly install the latest version to `C:\Program Files\nu`. To work around this, run `winget install nushell` again to install the latest version in the user scope.

- [Scoop](https://scoop.sh/) (`scoop install nu`)

For Debian & Ubuntu:

```
wget -qO- https://apt.fury.io/nushell/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/fury-nushell.gpg
echo "deb [signed-by=/etc/apt/keyrings/fury-nushell.gpg] https://apt.fury.io/nushell/ /" | sudo tee /etc/apt/sources.list.d/fury-nushell.list
sudo apt update
sudo apt install nushell
```

For RedHat/Fedora & Rocky Linux:

```
echo "[gemfury-nushell]
name=Gemfury Nushell Repo
baseurl=https://yum.fury.io/nushell/
enabled=1
gpgcheck=0
gpgkey=https://yum.fury.io/nushell/gpg.key" | sudo tee /etc/yum.repos.d/fury-nushell.repo
sudo dnf install -y nushell
```

For Alpine Linux:

```
echo "https://alpine.fury.io/nushell/" | tee -a /etc/apk/repositories
apk update
apk add --allow-untrusted nushell
```

Cross Platform installation:

- [npm](https://www.npmjs.com/) (`npm install -g nushell` Note that nu plugins are not included if you install in this way)

## [Docker Container Images](#docker-container-images)

Docker images are available from the GitHub Container Registry. An image for the latest release is built regularly for Alpine and Debian. You can run the image in interactive mode using:

```
docker run -it --rm ghcr.io/nushell/nushell:<version>-<distro>
```

Where `<version>` is the version of Nushell you want to run and `<distro>` is `alpine` or the latest supported Debian release, such as `bookworm`.

To run a specific command, use:

```
docker run --rm ghcr.io/nushell/nushell:latest-alpine -c "ls /usr/bin | where size > 10KiB"
```

To run a script from the current directory using Bash, use:

```
docker run --rm \
    -v $(pwd):/work \
    ghcr.io/nushell/nushell:latest-alpine \
    "/work/script.nu"
```

## [Build from Source](#build-from-source)

You can also build Nu from source. First, you will need to set up the Rust toolchain and its dependencies.

### [Installing a Compiler Suite](#installing-a-compiler-suite)

For Rust to work properly, you'll need to have a compatible compiler suite installed on your system. These are the recommended compiler suites:

- Linux: GCC or Clang
- macOS: Clang (install Xcode)
- Windows: MSVC (install [Visual Studio](https://visualstudio.microsoft.com/vs/community/) or the [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022))
  - Make sure to install the "Desktop development with C++" workload
  - Any Visual Studio edition will work (Community is free)

### [Installing Rust](#installing-rust)

If you don't already have Rust on our system, the best way to install it is via [rustup](https://rustup.rs/). Rustup is a way of managing Rust installations, including managing using different Rust versions.

Nu currently requires the **latest stable (1.66.1 or later)** version of Rust. The best way is to let `rustup` find the correct version for you. When you first open `rustup` it will ask what version of Rust you wish to install:

```
Current installation options:

default host triple: x86_64-unknown-linux-gnu
default toolchain: stable
profile: default
modify PATH variable: yes

1) Proceed with installation (default)
2) Customize installation
3) Cancel installation
```

Once you are ready, press 1 and then enter.

If you'd rather not install Rust via `rustup`, you can also install it via other methods (e.g. from a package in a Linux distro). Just be sure to install a version of Rust that is 1.66.1 or later.

### [Dependencies](#dependencies)

#### [Debian/Ubuntu](#debian-ubuntu)

You will need to install the "pkg-config", "build-essential" and "libssl-dev" packages:

```
apt install pkg-config libssl-dev build-essential
```

#### [RHEL based distros](#rhel-based-distros)

You will need to install "libxcb", "openssl-devel" and "libX11-devel":

```
yum install libxcb openssl-devel libX11-devel
```

#### [macOS](#macos)

##### [Homebrew](#homebrew)

Using [Homebrew](https://brew.sh/), you will need to install "openssl" and "cmake" using:

```
brew install openssl cmake
```

##### [Nix](#nix)

If using [Nix](https://nixos.org/download/#nix-install-macos) for package management on macOS, the `openssl`, `cmake`, `pkg-config`, and `curl` packages are required. These can be installed:

- Globally, using `nix-env --install` (and others).
- Locally, using [Home Manager](https://github.com/nix-community/home-manager) in your `home.nix` config.
- Temporarily, using `nix-shell` (and others).

### [Build from [crates.io](https://crates.io) using Cargo](#build-from-crates-io-using-cargo)

Nushell releases are published as source to the popular Rust package registry [crates.io](https://crates.io/). This makes it easy to build and install the latest Nu release with `cargo`:

```
cargo install nu --locked
```

The `cargo` tool will do the work of downloading Nu and its source dependencies, building it, and installing it into the cargo bin path.

Note that the default plugins must be installed separately when using `cargo`. See the [Plugins Installation](/book/plugins.html#core-plugins) section of the Book for instructions.

### [Building from the GitHub repository](#building-from-the-github-repository)

You can also build Nu from the latest source on GitHub. This gives you immediate access to the latest features and bug fixes. First, clone the repo:

```
git clone https://github.com/nushell/nushell.git
```

From there, we can build and run Nu with:

```
cd nushell
# ./nushell
cargo build --workspace; cargo run
```

You can also build and run Nu in release mode, which enables more optimizations:

```
cargo build --release --workspace; cargo run --release
```

People familiar with Rust may wonder why we do both a "build" and a "run" step if "run" does a build by default. This is to get around a shortcoming of the new `default-run` option in Cargo, and ensure that all plugins are built, though this may not be required in the future.

[Edit this page on GitHub](https://github.com/nushell/nushell.github.io/edit/main/book/installation.md)

Contributors: Carson Black, Ibraheem Ahmed, Jake Vossen, prrao87, Andrés N. Robalino, rashil2000, dgalbraith, Reilly Wood, Justin Ma, Adam Smith, fdncred, rgwood, max-nextcloud, Hofer-Julian, Mark Karpov, follower, Jakub Žádník, Garbaz, NotTheDr01ds, Kieron Wilkinson, allan2, Jan Klass, Stefan Holderbach, Nguyễn Hồng Quân, Phil Crockett

[Prev

Introduction](/book/)[Next

Default Shell](/book/default_shell.html)
