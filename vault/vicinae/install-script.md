[![logo-dark](/vicinae-dark.svg)![Logo](/vicinae.svg)](/)

Find something...`K`

[![logo-dark](/vicinae-dark.svg)![Logo](/vicinae.svg)](/)

- [Latest version](https://github.com/vicinaehq/vicinae/releases/latest)

- ## Installation
  - [Introduction](/)
  - [Install from repository](/install/repo)
  - [Install from script](/install/script)
  - [Build from source](/build)
  - [Build AppImage from source](/build-appimage)

- ## Quickstart
- [FAQ](/faq)
- [NixOS](/nixos)
- ## Manual
- ## Theming
- ## Script Commands
- ## Extensions
- Sign in

# Script Installation

Vicinae can be installed using an automated installation script that provides a hassle-free setup experience with minimal configuration required.

If Vicinae is already packaged by your distribution, you should install it through your package manager instead for better system integration and automatic updates.

![Installation script demo](/script-install.png)

_Installation script by [@dagimg-dot](https://github.com/dagimg-dot)_

## [Quick Install](#quick-install)

Run the following command to install Vicinae:

```
curl -fsSL https://vicinae.com/install.sh | bash
```

CopyCopied!

The above command will prompt you to enter your sudo password, as elevated privileges are required to install Vicinae under `/usr/local`, which is the default installation prefix.
Note that it is possible to install Vicinae without root access, although it requires more setup. More on that below.

The installation script will automatically:

- Download the latest AppImage from GitHub releases
- Extract Vicinae and all its runtime dependencies to `/usr/local/lib/vicinae`
- Create symbolic links for binaries in your PATH
- Install desktop files, icons, and default themes
- Set up `vicinae-node` for seamless TypeScript extension support. This is a regular Node.js binary included to run extensions.

After installation completes, verify it was successful:

```
$> vicinae version
Version v0.16.2 (commit b99015bc2)
Build: GCC 15.2.0 - Release - LTO
Provenance: appimage
```

CopyCopied!

## [Update](#update)

To update Vicinae, run the installation script again. It will detect your existing installation (if using the same prefix) and update it.

```
curl -fsSL https://vicinae.com/install.sh | bash
```

CopyCopied!

## [Uninstall](#uninstall)

To uninstall Vicinae, run the installation script with the `--uninstall` argument:

```
curl -fsSL https://vicinae.com/install.sh | bash -s -- --uninstall
```

CopyCopied!

## [Install with custom prefix](#install-with-custom-prefix)

By default, the script tries to install Vicinae under `/usr/local`, but for users with specific constraints (e.g., no root access), this might not be desirable.

To accommodate these users, the script provides a `--prefix` option:

```
curl -fsSL https://vicinae.com/install.sh | bash -s -- --prefix ~/.local
```

CopyCopied!

### [Custom prefix caveats](#custom-prefix-caveats)

In order to have a fully working installation of Vicinae, you need to make sure that:

- The Vicinae server knows where to find the `vicinae-node` binary. If you set your PATH in `~/.bashrc` or `~/.zshrc`, the Vicinae server might not have the correct PATH set, as it might be started before those files are sourced.
- The Vicinae desktop file that declares the `x-scheme-handler/vicinae` and `x-scheme-handler/raycast` MIME type associations should be searchable by the standard XDG tooling. You can verify this is working by opening any Vicinae deeplink, e.g., `xdg-open vicinae://toggle`.
  If this is not working, some features such as the OAuth extension flow will not work.

Was this page helpful?

YesNo

[Previous](/install/repo)[Install from repository](/install/repo)

[Next](/build)[Build from source](/build)

© Copyright 2026. All rights reserved.

[Follow us on GitHub](https://github.com/vicinaehq)

## On this page

- [Quick Install](#quick-install)
- [Update](#update)
- [Uninstall](#uninstall)
- [Install with custom prefix](#install-with-custom-prefix)
  - [Custom prefix caveats](#custom-prefix-caveats)
