# Nix 2.28.6 Reference Manual

# [Name](#name)

`nix-env` - manipulate or query Nix user environments

# [Synopsis](#synopsis)

`nix-env` _operation_ [*options*] [*arguments…*]
[`--option` *name* *value*]
[`--arg` *name* *value*]
[`--argstr` *name* *value*]
[{`--file` | `-f`} *path*]
[{`--profile` | `-p`} *path*]
[`--system-filter` *system*]
[`--dry-run`]

# [Description](#description)

The command `nix-env` is used to manipulate Nix user environments. User
environments are sets of software packages available to a user at some
point in time. In other words, they are a synthesised view of the
programs available in the Nix store. There may be many user
environments: different users can have different environments, and
individual users can switch between different environments.

`nix-env` takes exactly one _operation_ flag which indicates the
subcommand to be performed. The following operations are available:

- [`--install`](/manual/nix/2.28/command-ref/nix-env/install)
- [`--upgrade`](/manual/nix/2.28/command-ref/nix-env/upgrade)
- [`--uninstall`](/manual/nix/2.28/command-ref/nix-env/uninstall)
- [`--set`](/manual/nix/2.28/command-ref/nix-env/set)
- [`--set-flag`](/manual/nix/2.28/command-ref/nix-env/set-flag)
- [`--query`](/manual/nix/2.28/command-ref/nix-env/query)
- [`--switch-profile`](/manual/nix/2.28/command-ref/nix-env/switch-profile)
- [`--list-generations`](/manual/nix/2.28/command-ref/nix-env/list-generations)
- [`--delete-generations`](/manual/nix/2.28/command-ref/nix-env/delete-generations)
- [`--switch-generation`](/manual/nix/2.28/command-ref/nix-env/switch-generation)
- [`--rollback`](/manual/nix/2.28/command-ref/nix-env/rollback)

These pages can be viewed offline:

- `man nix-env-<operation>`.

  Example: `man nix-env-install`

- `nix-env --help --<operation>`

  Example: `nix-env --help --install`

# [Package sources](#package-sources)

`nix-env` can obtain packages from multiple sources:

- An attribute set of derivations from:
  - The [default Nix expression](/manual/nix/2.28/command-ref/files/default-nix-expression) (by default)
  - A Nix file, specified via `--file`
  - A [profile](/manual/nix/2.28/command-ref/files/profiles), specified via `--from-profile`
  - A Nix expression that is a function which takes default expression as argument, specified via `--from-expression`
- A [store path](/manual/nix/2.28/store/store-path)

# [Selectors](#selectors)

Several operations, such as [`nix-env --query`](/manual/nix/2.28/command-ref/nix-env/query) and [`nix-env --install`](/manual/nix/2.28/command-ref/nix-env/install), take a list of _arguments_ that specify the packages on which to operate.

Packages are identified based on a `name` part and a `version` part of a [symbolic derivation name](/manual/nix/2.28/language/derivations#attr-name):

- `name`: Everything up to but not including the first dash (`-`) that is _not_ followed by a letter.
- `version`: The rest, excluding the separating dash.

> **Example**
>
> `nix-env` parses the symbolic derivation name `apache-httpd-2.0.48` as:
>
> ```
> {
>   "name": "apache-httpd",
>   "version": "2.0.48"
> }
> ```

> **Example**
>
> `nix-env` parses the symbolic derivation name `firefox.*` as:
>
> ```
> {
>   "name": "firefox.*",
>   "version": ""
> }
> ```

The `name` parts of the _arguments_ to `nix-env` are treated as extended regular expressions and matched against the `name` parts of derivation names in the package source.
The match is case-sensitive.
The regular expression can optionally be followed by a dash (`-`) and a version number; if omitted, any version of the package will match.
For details on regular expressions, see [**regex**(7)](https://linux.die.net/man/7/regex).

> **Example**
>
> Common patterns for finding package names with `nix-env`:
>
> - `firefox`
>
>   Matches the package name `firefox` and any version.
>
> - `firefox-32.0`
>
>   Matches the package name `firefox` and version `32.0`.
>
> - `gtk\\+`
>
>   Matches the package name `gtk+`.
>   The `+` character must be escaped using a backslash (`\`) to prevent it from being interpreted as a quantifier, and the backslash must be escaped in turn with another backslash to ensure that the shell passes it on.
>
> - `.\*`
>
>   Matches any package name.
>   This is the default for most commands.
>
> - `'.*zip.*'`
>
>   Matches any package name containing the string `zip`.
>   Note the dots: `'*zip*'` does not work, because in a regular expression, the character `*` is interpreted as a quantifier.
>
> - `'.*(firefox|chromium).*'`
>
>   Matches any package name containing the strings `firefox` or `chromium`.

# [Files](#files)

`nix-env` operates on the following files.

## [Default Nix expression](#default-nix-expression)

The source for the [Nix expressions](/manual/nix/2.28/glossary#gloss-nix-expression) used by [`nix-env`](/manual/nix/2.28/command-ref/nix-env) by default:

- `~/.nix-defexpr`
- `$XDG_STATE_HOME/nix/defexpr` if [`use-xdg-base-directories`](/manual/nix/2.28/command-ref/conf-file#conf-use-xdg-base-directories) is set to `true`.

It is loaded as follows:

- If the default expression is a file, it is loaded as a Nix expression.
- If the default expression is a directory containing a `default.nix` file, that `default.nix` file is loaded as a Nix expression.
- If the default expression is a directory without a `default.nix` file, then its contents (both files and subdirectories) are loaded as Nix expressions.
  The expressions are combined into a single attribute set, each expression under an attribute with the same name as the original file or subdirectory.
  Subdirectories without a `default.nix` file are traversed recursively in search of more Nix expressions, but the names of these intermediate directories are not added to the attribute paths of the default Nix expression.

Then, the resulting expression is interpreted like this:

- If the expression is an attribute set, it is used as the default Nix expression.
- If the expression is a function, an empty set is passed as argument and the return value is used as the default Nix expression.

> **Example**
>
> If the default expression contains two files, `foo.nix` and `bar.nix`, then the default Nix expression will be equivalent to
>
> ```
> {
>   foo = import ~/.nix-defexpr/foo.nix;
>   bar = import ~/.nix-defexpr/bar.nix;
> }
> ```

The file [`manifest.nix`](/manual/nix/2.28/command-ref/files/manifest.nix) is always ignored.

The command [`nix-channel`](/manual/nix/2.28/command-ref/nix-channel) places a symlink to the current user's [channels](/manual/nix/2.28/command-ref/files/channels) in this directory, the [user channel link](#user-channel-link).
This makes all subscribed channels available as attributes in the default expression.

## [User channel link](#user-channel-link)

A symlink that ensures that [`nix-env`](/manual/nix/2.28/command-ref/nix-env) can find the current user's [channels](/manual/nix/2.28/command-ref/files/channels):

- `~/.nix-defexpr/channels`
- `$XDG_STATE_HOME/defexpr/channels` if [`use-xdg-base-directories`](/manual/nix/2.28/command-ref/conf-file#conf-use-xdg-base-directories) is set to `true`.

This symlink points to:

- `$XDG_STATE_HOME/profiles/channels` for regular users
- `$NIX_STATE_DIR/profiles/per-user/root/channels` for `root`

In a multi-user installation, you may also have `~/.nix-defexpr/channels_root`, which links to the channels of the root user.

## [Profiles](#profiles)

A directory that contains links to profiles managed by [`nix-env`](/manual/nix/2.28/command-ref/nix-env) and [`nix profile`](/manual/nix/2.28/command-ref/new-cli/nix3-profile):

- `$XDG_STATE_HOME/nix/profiles` for regular users
- `$NIX_STATE_DIR/profiles/per-user/root` if the user is `root`

A profile is a directory of symlinks to files in the Nix store.

### [Filesystem layout](#filesystem-layout)

Profiles are versioned as follows. When using a profile named _path_, _path_ is a symlink to _path_`-`_N_`-link`, where _N_ is the version of the profile.
In turn, _path_`-`_N_`-link` is a symlink to a path in the Nix store.
For example:

```
$ ls -l ~alice/.local/state/nix/profiles/profile*
lrwxrwxrwx 1 alice users 14 Nov 25 14:35 /home/alice/.local/state/nix/profiles/profile -> profile-7-link
lrwxrwxrwx 1 alice users 51 Oct 28 16:18 /home/alice/.local/state/nix/profiles/profile-5-link -> /nix/store/q69xad13ghpf7ir87h0b2gd28lafjj1j-profile
lrwxrwxrwx 1 alice users 51 Oct 29 13:20 /home/alice/.local/state/nix/profiles/profile-6-link -> /nix/store/6bvhpysd7vwz7k3b0pndn7ifi5xr32dg-profile
lrwxrwxrwx 1 alice users 51 Nov 25 14:35 /home/alice/.local/state/nix/profiles/profile-7-link -> /nix/store/mp0x6xnsg0b8qhswy6riqvimai4gm677-profile
```

Each of these symlinks is a root for the Nix garbage collector.

The contents of the store path corresponding to each version of the
profile is a tree of symlinks to the files of the installed packages,
e.g.

```
$ ll -R ~eelco/.local/state/nix/profiles/profile-7-link/
/home/eelco/.local/state/nix/profiles/profile-7-link/:
total 20
dr-xr-xr-x 2 root root 4096 Jan  1  1970 bin
-r--r--r-- 2 root root 1402 Jan  1  1970 manifest.nix
dr-xr-xr-x 4 root root 4096 Jan  1  1970 share

/home/eelco/.local/state/nix/profiles/profile-7-link/bin:
total 20
lrwxrwxrwx 5 root root 79 Jan  1  1970 chromium -> /nix/store/ijm5k0zqisvkdwjkc77mb9qzb35xfi4m-chromium-86.0.4240.111/bin/chromium
lrwxrwxrwx 7 root root 87 Jan  1  1970 spotify -> /nix/store/w9182874m1bl56smps3m5zjj36jhp3rn-spotify-1.1.26.501.gbe11e53b-15/bin/spotify
lrwxrwxrwx 3 root root 79 Jan  1  1970 zoom-us -> /nix/store/wbhg2ga8f3h87s9h5k0slxk0m81m4cxl-zoom-us-5.3.469451.0927/bin/zoom-us

/home/eelco/.local/state/nix/profiles/profile-7-link/share/applications:
total 12
lrwxrwxrwx 4 root root 120 Jan  1  1970 chromium-browser.desktop -> /nix/store/ijm5k0zqisvkdwjkc77mb9qzb35xfi4a-chromium-unwrapped-86.0.4240.111/share/applications/chromium-browser.desktop
lrwxrwxrwx 7 root root 110 Jan  1  1970 spotify.desktop -> /nix/store/w9182874m1bl56smps3m5zjj36jhp3rn-spotify-1.1.26.501.gbe11e53b-15/share/applications/spotify.desktop
lrwxrwxrwx 3 root root 107 Jan  1  1970 us.zoom.Zoom.desktop -> /nix/store/wbhg2ga8f3h87s9h5k0slxk0m81m4cxl-zoom-us-5.3.469451.0927/share/applications/us.zoom.Zoom.desktop

…
```

Each profile version contains a manifest file:

- [`manifest.nix`](/manual/nix/2.28/command-ref/files/manifest.nix) used by [`nix-env`](/manual/nix/2.28/command-ref/nix-env).
- [`manifest.json`](/manual/nix/2.28/command-ref/files/manifest.json) used by [`nix profile`](/manual/nix/2.28/command-ref/new-cli/nix3-profile) (experimental).

## [User profile link](#user-profile-link)

A symbolic link to the user's current profile:

- `~/.nix-profile`
- `$XDG_STATE_HOME/nix/profile` if [`use-xdg-base-directories`](/manual/nix/2.28/command-ref/conf-file#conf-use-xdg-base-directories) is set to `true`.

By default, this symlink points to:

- `$XDG_STATE_HOME/nix/profiles/profile` for regular users
- `$NIX_STATE_DIR/profiles/per-user/root/profile` for `root`

The `PATH` environment variable should include `/bin` subdirectory of the profile link (e.g. `~/.nix-profile/bin`) for the user environment to be visible to the user.
The [installer](/manual/nix/2.28/installation/installing-binary) sets this up by default, unless you enable [`use-xdg-base-directories`](/manual/nix/2.28/command-ref/conf-file#conf-use-xdg-base-directories).
