# Nix 2.28.6 Reference Manual

# Introduction

Nix is a *purely functional package manager*.

```
/nix/store/b6gvzjyb2pg0kjfwrjmg1vfhh54ad73z-firefox-33.1/
```

where `b6gvzjyb2pg0…` is a unique identifier for the package that captures all its dependencies (it’s a cryptographic hash of the package’s build dependency graph).

## Multiple versions

You can have multiple versions or variants of a package installed at the same time.

An important consequence is that operations like upgrading or uninstalling an application cannot break other applications, since these operations never “destructively” update or delete files that are used by other packages.

## Complete dependencies

Nix helps you make sure that package dependency specifications are complete.

Since Nix on the other hand doesn’t install packages in “global” locations like `/usr/bin` but in package-specific directories, the risk of incomplete dependencies is greatly reduced.

Once a package is built, runtime dependencies are found by scanning binaries for the hash parts of Nix store paths (such as `r8vvq9kq…`).

## Multi-user support

Nix has multi-user support. This means that non-privileged users can securely install software.

## Atomic upgrades and rollbacks

Since package management operations never overwrite packages in the Nix store but add new versions in different paths, they are *atomic*.

And since packages aren’t overwritten, the old versions are still there after an upgrade.

```
$ nix-env --upgrade --attr nixpkgs.some-package
$ nix-env --rollback
```

## Garbage collection

When you uninstall a package like this…

```
$ nix-env --uninstall firefox
```

the package isn’t deleted from the system right away (after all, you might want to do a rollback, or it might be in the profiles of other users).

```
$ nix-collect-garbage
```

This deletes all packages that aren’t in use by any user profile or by a currently running program.

## Functional package language

Packages are built from *Nix expressions*, which is a simple functional language.

Because it’s a functional language, it’s easy to support building variants of a package: turn the Nix expression into a function and call it any number of times with the appropriate arguments.

## Transparent source/binary deployment

Nix expressions generally describe how to build a package from source, so an installation action like

```
$ nix-env --install --attr nixpkgs.firefox
```

*could* cause quite a bit of build activity, as not only Firefox but also all its dependencies (all the way up to the C library and the compiler) would have to be built, at least if they are not already in the Nix store.

## Nix Packages collection

We provide a large set of Nix expressions containing hundreds of existing Unix packages, the *Nix Packages collection* (Nixpkgs).

## Managing build environments

Nix is extremely useful for developers as it makes it easy to automatically set up the build environment for a package.

For example, the following command gets all dependencies of the Pan newsreader, as described by [its Nix expression](https://github.com/NixOS/nixpkgs/blob/master/pkgs/applications/networking/newsreaders/pan/default.nix):

```
$ nix-shell '<nixpkgs>' --attr pan
```

You’re then dropped into a shell where you can edit, build and test the package:

```
[nix-shell]$ unpackPhase
[nix-shell]$ cd pan-*
[nix-shell]$ configurePhase
[nix-shell]$ buildPhase
[nix-shell]$ ./pan/gui/pan
```

## Portability

Nix runs on Linux and macOS.

## NixOS

NixOS is a Linux distribution based on Nix. It uses Nix not for package management but also to manage the system configuration (e.g., to build configuration files in `/etc`).

## License

Nix is released under the terms of the [GNU LGPLv2.1 or (at your option) any later version](http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html).
