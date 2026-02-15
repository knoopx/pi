# Nix 2.28.6 Reference Manual

# Name

`nix-shell` - start an interactive shell based on a Nix expression

# Synopsis

`nix-shell` [`--arg` *name* *value*] [`--argstr` *name* *value*] [{`--attr` | `-A`} *attrPath*] [`--command` *cmd*] [`--run` *cmd*] [`--exclude` *regexp*] [`--pure`] [`--keep` *name*] {{`--packages` | `-p`} {*packages* | *expressions*} … | [*path*]}

# Disambiguation

This man page describes the command `nix-shell`, which is distinct from `nix shell`.

# Description

The command `nix-shell` will build the dependencies of the specified derivation, but not the derivation itself.

If *path* is not given, `nix-shell` defaults to `shell.nix` if it exists, and `default.nix` otherwise.

If *path* starts with `http://` or `https://`, it is interpreted as the URL of a tarball that will be downloaded and unpacked to a temporary location.

If the derivation defines the variable `shellHook`, it will be run after `$stdenv/setup` has been sourced.

```
shellHook =
  ''
    echo "Hello shell"
    export SOME_API_TOKEN="$(cat ~/.config/some-app/api-token)"
  '';
```

will cause `nix-shell` to print `Hello shell` and set the `SOME_API_TOKEN` environment variable to a user-configured value.

# Options

All options not listed here are passed to `nix-store --realise`, except for `--arg` and `--attr` / `-A` which are passed to `nix-instantiate`.

- `--command` *cmd*

In the environment of the derivation, run the shell command *cmd*.

- `--run` *cmd*

Like `--command`, but executes the command in a non-interactive shell.

- `--exclude` *regexp*

Do not build any dependencies whose store path matches the regular expression *regexp*.

- `--pure`

If this flag is specified, the environment is almost entirely cleared before the interactive shell is started, so you get an environment that more closely corresponds to the "real" Nix build.

- `--packages` / `-p` *packages*…

Set up an environment in which the specified packages are present. The command line arguments are interpreted as attribute names inside the Nix Packages collection.

- `-i` *interpreter*

The chained script interpreter to be invoked by `nix-shell`. Only applicable in `#!`-scripts (described below).

- `--keep` *name*

When a `--pure` shell is started, keep the listed environment variables.

# Common Options

Most Nix commands accept the following command-line options:

- [`--help`](#opt-help)

Prints out a summary of the command syntax and exits.

- [`--version`](#opt-version)

Prints out the Nix version number on standard output and exits.

- [`--verbose`](#opt-verbose) / `-v`

Increases the level of verbosity of diagnostic messages printed on standard error.

This option may be specified repeatedly. Currently, the following verbosity levels exist:

  - `0` "Errors only"

Only print messages explaining why the Nix invocation failed.

  - `1` "Informational"

Print *useful* messages about what Nix is doing. This is the default.

  - `2` "Talkative"

Print more informational messages.

  - `3` "Chatty"

Print even more informational messages.

  - `4` "Debug"

Print debug information.

  - `5` "Vomit"

Print vast amounts of debug information.

- [`--quiet`](#opt-quiet)

Decreases the level of verbosity of diagnostic messages printed on standard error.

This option may be specified repeatedly. See the previous verbosity levels list.

- [`--log-format`](#opt-log-format) *format*

This option can be used to change the output of the log format, with *format* being one of:

  - `raw`

This is the raw format, as outputted by nix-build.

  - `internal-json`

Outputs the logs in a structured manner.

    > **Warning**
>
    > While the schema itself is relatively stable, the format of the error-messages (namely of the `msg`-field) can change between releases.

  - `bar`

Only display a progress bar during the builds.

  - `bar-with-logs`

Display the raw logs, with the progress bar at the bottom.

- [`--no-build-output`](#opt-no-build-output) / `-Q`

By default, output written by builders to standard output and standard error is echoed to the Nix command's standard error.

- [`--max-jobs`](#opt-max-jobs) / `-j` *number*

Sets the maximum number of build jobs that Nix will perform in parallel to the specified number.

Setting it to `0` disallows building on the local machine, which is useful when you want builds to happen only on remote builders.

- [`--cores`](#opt-cores)

Sets the value of the `NIX_BUILD_CORES` environment variable in the invocation of builders.

- [`--max-silent-time`](#opt-max-silent-time)

Sets the maximum number of seconds that a builder can go without producing any data on standard output or standard error.

- [`--timeout`](#opt-timeout)

Sets the maximum number of seconds that a builder can run. The default is specified by the `timeout` configuration setting.

- [`--keep-going`](#opt-keep-going) / `-k`

Keep going in case of failed builds, to the greatest extent possible. That is, if building an input of some derivation fails, Nix will still build the other inputs, but not the derivation itself.

- [`--keep-failed`](#opt-keep-failed) / `-K`

Specifies that in case of a build failure, the temporary directory (usually in `/tmp`) in which the build takes place should not be deleted.

- [`--fallback`](#opt-fallback)

Whenever Nix attempts to build a derivation for which substitutes are known for each output path, but realising the output paths through the substitutes fails, fall back on building the derivation.

The most common scenario in which this is useful is when we have registered substitutes in order to perform binary distribution from, say, a network repository.

- [`--readonly-mode`](#opt-readonly-mode)

When this option is used, no attempt is made to open the Nix database.

- [`--arg`](#opt-arg) *name* *value*

This option is accepted by `nix-env`, `nix-instantiate`, `nix-shell` and `nix-build`.

With `--arg`, you can also call functions that have arguments without a default value (or override a default value).

For instance, the top-level `default.nix` in Nixpkgs is actually a function:

  ```
  { # The system (e.g., `i686-linux') for which to build the packages.
    system ? builtins.currentSystem
    ...
  }: ...
  ```

So if you call this Nix expression (e.g., when you do `nix-env --install --attr pkgname`), the function will be called automatically using the value [`builtins.currentSystem`](/manual/nix/2.28/language/builtins) for the `system` argument.

- [`--arg-from-file`](#opt-arg-from-file) *name* *path*

Pass the contents of file *path* as the argument *name* to Nix functions.

- [`--arg-from-stdin`](#opt-arg-from-stdin) *name*

Pass the contents of stdin as the argument *name* to Nix functions.

- [`--argstr`](#opt-argstr) *name* *value*

This option is like `--arg`, only the value is not a Nix expression but a string.

- [`--attr`](#opt-attr) / `-A` *attrPath*

Select an attribute from the top-level Nix expression being evaluated. (`nix-env`, `nix-instantiate`, `nix-build` and `nix-shell` only.) The *attribute path* *attrPath* is a sequence of attribute names separated by dots.

In addition to attribute names, you can also specify array indices.

- [`--eval-store`](#opt-eval-store) *store-url*

The [URL to the Nix store](/manual/nix/2.28/store/types/#store-url-format) to use for evaluation, i.e. where to store derivations (`.drv` files) and inputs referenced by them.

- [`--expr`](#opt-expr) / `-E`

Interpret the command line arguments as a list of Nix expressions to be parsed and evaluated, rather than as a list of file names of Nix expressions. (`nix-instantiate`, `nix-build` and `nix-shell` only.)

For `nix-shell`, this option is commonly used to give you a shell in which you can build the packages returned by the expression.

- [`-I` / `--include`](#opt-I) *path*

Add an entry to the list of search paths used to resolve [lookup paths](/manual/nix/2.28/language/constructs/lookup-path).

Paths added through `-I` take precedence over the [`nix-path` configuration setting](/manual/nix/2.28/command-ref/conf-file#conf-nix-path) and the [`NIX_PATH` environment variable](/manual/nix/2.28/command-ref/env-common#env-NIX_PATH).

- [`--impure`](#opt-impure)

Allow access to mutable paths and repositories.

- [`--option`](#opt-option) *name* *value*

Set the Nix configuration option *name* to *value*. This overrides settings in the Nix configuration file (see nix.conf5).

- [`--repair`](#opt-repair)

Fix corrupted or missing store paths by redownloading or rebuilding them.

> **Note**
>
> See [`man nix.conf`](/manual/nix/2.28/command-ref/conf-file#command-line-flags) for overriding configuration settings with command line flags.

# Environment variables

- [`NIX_BUILD_SHELL`](#env-NIX_BUILD_SHELL)

Shell used to start the interactive environment. Defaults to the `bash` from `bashInteractive` found in `<nixpkgs>`, falling back to the `bash` found in `PATH` if not found.

  > **Note**
>
  > The shell obtained using this method may not necessarily be the same as any shells requested in *path*.

  > **Example
>
  > Despite `--pure`, this invocation will not result in a fully reproducible shell environment:
>
  > ```
  > #!/usr/bin/env -S nix-shell --pure
  > let
  >   pkgs = import (fetchTarball "https://github.com/NixOS/nixpkgs/archive/854fdc68881791812eddd33b2fed94b954979a8e.tar.gz") {};
  > in
  > pkgs.mkShell {
  >   buildInputs = pkgs.bashInteractive;
  > }
  > ```

# Common Environment Variables

Most Nix commands interpret the following environment variables:

- [`IN_NIX_SHELL`](#env-IN_NIX_SHELL)

Indicator that tells if the current environment was set up by `nix-shell`.

- [`NIX_PATH`](#env-NIX_PATH)

A colon-separated list of search path entries used to resolve [lookup paths](/manual/nix/2.28/language/constructs/lookup-path).

This environment variable overrides the value of the [`nix-path` configuration setting](/manual/nix/2.28/command-ref/conf-file#conf-nix-path).

It can be extended using the [`-I` option](/manual/nix/2.28/command-ref/opt-common#opt-I).

  > **Example**
>
  > ```
  > $ export NIX_PATH=`/home/eelco/Dev:nixos-config=/etc/nixos
  > ```

If `NIX_PATH` is set to an empty string, resolving search paths will always fail.

  > **Example**
>
  > ```
  > $ NIX_PATH= nix-instantiate --eval '<nixpkgs>'
  > error: file 'nixpkgs' was not found in the Nix search path (add it using $NIX_PATH or -I)
  > ```

- [`NIX_IGNORE_SYMLINK_STORE`](#env-NIX_IGNORE_SYMLINK_STORE)

Normally, the Nix store directory (typically `/nix/store`) is not allowed to contain any symlink components.

if you're symlinking the Nix store so that you can put it on another file system than the root file system, on Linux you're better off using `bind` mount points, e.g.

  ```
  $ mkdir /nix
  $ mount -o bind /mnt/otherdisk/nix /nix
  ```

Consult the mount 8 manual page for details.

- [`NIX_STORE_DIR`](#env-NIX_STORE_DIR)

Overrides the location of the Nix store (default `prefix/store`).

- [`NIX_DATA_DIR`](#env-NIX_DATA_DIR)

Overrides the location of the Nix static data directory (default `prefix/share`).

- [`NIX_LOG_DIR`](#env-NIX_LOG_DIR)

Overrides the location of the Nix log directory (default `prefix/var/log/nix`).

- [`NIX_STATE_DIR`](#env-NIX_STATE_DIR)

Overrides the location of the Nix state directory (default `prefix/var/nix`).

- [`NIX_CONF_DIR`](#env-NIX_CONF_DIR)

Overrides the location of the system Nix configuration directory (default `prefix/etc/nix`).

- [`NIX_CONFIG`](#env-NIX_CONFIG)

Applies settings from Nix configuration from the environment. The content is treated as if it was read from a Nix configuration file.

- [`NIX_USER_CONF_FILES`](#env-NIX_USER_CONF_FILES)

Overrides the location of the Nix user configuration files to load from.

The default are the locations according to the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html).

The variable is treated as a list separated by the `:` token.

- [`TMPDIR`](#env-TMPDIR)

Use the specified directory to store temporary files. In particular, this includes temporary build directories; these can take up substantial amounts of disk space.

- [`NIX_REMOTE`](#env-NIX_REMOTE)

This variable should be set to `daemon` if you want to use the Nix daemon to execute Nix operations.

- [`NIX_SHOW_STATS`](#env-NIX_SHOW_STATS)

If set to `1`, Nix will print some evaluation statistics, such as the number of values allocated.

- [`NIX_COUNT_CALLS`](#env-NIX_COUNT_CALLS)

If set to `1`, Nix will print how often functions were called during Nix expression evaluation.

- [`GC_INITIAL_HEAP_SIZE`](#env-GC_INITIAL_HEAP_SIZE)

If Nix has been configured to use the Boehm garbage collector, this variable sets the initial size of the heap in bytes.

## XDG Base Directories

Nix follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html).

For backwards compatibility, Nix commands will follow the standard only when [`use-xdg-base-directories`](/manual/nix/2.28/command-ref/conf-file#conf-use-xdg-base-directories) is enabled.

The following environment variables are used to determine locations of various state and configuration files:

- [`XDG_CONFIG_HOME`](#env-XDG_CONFIG_HOME) (default `~/.config`)
- [`XDG_STATE_HOME`](#env-XDG_STATE_HOME) (default `~/.local/state`)
- [`XDG_CACHE_HOME`](#env-XDG_CACHE_HOME) (default `~/.cache`)

In addition, setting the following environment variables overrides the XDG base directories:

- [`NIX_CONFIG_HOME`](#env-NIX_CONFIG_HOME) (default `$XDG_CONFIG_HOME/nix`)
- [`NIX_STATE_HOME`](#env-NIX_STATE_HOME) (default `$XDG_STATE_HOME/nix`)
- [`NIX_CACHE_HOME`](#env-NIX_CACHE_HOME) (default `$XDG_CACHE_HOME/nix`)

When [`use-xdg-base-directories`](/manual/nix/2.28/command-ref/conf-file#conf-use-xdg-base-directories) is enabled, the configuration directory is:

1.  `$NIX_CONFIG_HOME`, if it is defined
2.  Otherwise, `$XDG_CONFIG_HOME/nix`, if `XDG_CONFIG_HOME` is defined
3.  Otherwise, `~/.config/nix`.

Likewise for the state and cache directories.

# Examples

To build the dependencies of the package Pan, and start an interactive shell in which to build it:

```
$ nix-shell '<nixpkgs>' --attr pan
[nix-shell]$ eval ${unpackPhase:-unpackPhase}
[nix-shell]$ cd $sourceRoot
[nix-shell]$ eval ${patchPhase:-patchPhase}
[nix-shell]$ eval ${configurePhase:-configurePhase}
[nix-shell]$ eval ${buildPhase:-buildPhase}
[nix-shell]$ ./pan/gui/pan
```

The reason we use form `eval ${configurePhase:-configurePhase}` here is because those packages that override these phases do so by exporting the overridden values in the environment variable of the same name.

To clear the environment first, and do some additional automatic initialisation of the interactive shell:

```
$ nix-shell '<nixpkgs>' --attr pan --pure \
    --command 'export NIX_DEBUG=1; export NIX_CORES=8; return'
```

Nix expressions can also be given on the command line using the `-E` and `-p` flags.

```
$ nix-shell --expr 'with import <nixpkgs> { }; runCommand "dummy" { buildInputs = [ sqlite xorg.libX11 ]; } ""'
```

A shorter way to do the same is:

```
$ nix-shell --packages sqlite xorg.libX11
[nix-shell]$ echo $NIX_LDFLAGS
… -L/nix/store/j1zg5v…-sqlite-3.8.0.2/lib -L/nix/store/0gmcz9…-libX11-1.6.1/lib …
```

`-p` accepts multiple full nix expressions that are valid in the `buildInputs = [ ... ]` shown above, not only package names.

```
$ nix-shell --packages sqlite 'git.override { withManual = false; }'
```

The `-p` flag looks up Nixpkgs in the Nix search path. You can override it by passing `-I` or setting `NIX_PATH`.

```
$ nix-shell --packages pan -I nixpkgs=https://github.com/NixOS/nixpkgs/archive/8a3eea054838b55aca962c3fbde9c83c102b8bf2.tar.gz

[nix-shell:~]$ pan --version
Pan 0.139
```

# Use as a `#!`-interpreter

You can use `nix-shell` as a script interpreter to allow scripts written in arbitrary languages to obtain their own dependencies via Nix.

```
#! /usr/bin/env nix-shell
#! nix-shell -i real-interpreter --packages packages
```

where *real-interpreter* is the "real" script interpreter that will be invoked by `nix-shell` after it has obtained the dependencies and initialised the environment, and *packages* are the attribute names of the dependencies in Nixpkgs.

The lines starting with `#! nix-shell` specify `nix-shell` options (see above).

For example, here is a Python script that depends on Python and the `prettytable` package:

```
#! /usr/bin/env nix-shell
#! nix-shell -i python3 --packages python3 python3Packages.prettytable

import prettytable

# Print a simple table.
t = prettytable.PrettyTable(["N", "N^2"])
for n in range(1, 10): t.add_row([n, n * n])
print(t)
```

Similarly, the following is a Perl script that specifies that it requires Perl and the `HTML::TokeParser::Simple` and `LWP` packages:

```
#! /usr/bin/env nix-shell
#! nix-shell -i perl --packages perl perlPackages.HTMLTokeParserSimple perlPackages.LWP

use HTML::TokeParser::Simple;

# Fetch nixos.org and print all hrefs.
my $p = HTML::TokeParser::Simple->new(url => 'http://nixos.org/');

while (my $token = $p->get_tag("a")) {
    my $href = $token->get_attr("href");
    print "$href\n" if $href;
}
```

Sometimes you need to pass a simple Nix expression to customize a package like Terraform:

```
#! /usr/bin/env nix-shell
#! nix-shell -i bash --packages 'terraform.withPlugins (plugins: [ plugins.openstack ])'

terraform apply
```

> **Note**
>
> You must use single or double quotes (`'`, `"`) when passing a simple Nix expression in a nix-shell shebang.

Finally, using the merging of multiple nix-shell shebangs the following Haskell script uses a specific branch of Nixpkgs/NixOS (the 20.03 stable branch):

```
#! /usr/bin/env nix-shell
#! nix-shell -i runghc --packages 'haskellPackages.ghcWithPackages (ps: [ps.download-curl ps.tagsoup])'
#! nix-shell -I nixpkgs=https://github.com/NixOS/nixpkgs/archive/nixos-20.03.tar.gz

import Network.Curl.Download
import Text.HTML.TagSoup
import Data.Either
import Data.ByteString.Char8 (unpack)

-- Fetch nixos.org and print all hrefs.
main = do
  resp <- openURI "https://nixos.org/"
  let tags = filter (isTagOpenName "a") $ parseTags $ unpack $ fromRight undefined resp
  let tags' = map (fromAttrib "href") tags
  mapM_ putStrLn $ filter (/= "") tags'
```

If you want to be even more precise, you can specify a specific revision of Nixpkgs:

```
#! nix-shell -I nixpkgs=https://github.com/NixOS/nixpkgs/archive/0672315759b3e15e2121365f067c1c8c56bb4722.tar.gz
```

The examples above all used `-p` to get dependencies from Nixpkgs. You can also use a Nix expression to build your own dependencies.

```
#! /usr/bin/env nix-shell
#! nix-shell deps.nix -i python
```

where the file `deps.nix` in the same directory as the `#!`-script contains:

```
with import <nixpkgs> {};

runCommand "dummy" { buildInputs = [ python pythonPackages.prettytable ]; } ""
```

The script's file name is passed as the first argument to the interpreter specified by the `-i` flag.

Aside from the first line, which is a directive to the operating system, the additional `#! nix-shell` lines do not need to be at the beginning of the file.
