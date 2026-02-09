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

# Installation

Most direct ways to install Vicinae on your system. If your system is not listed here you can either [install from script](/install/script) or [build from source](/build).

## [Arch Linux (AUR)](#arch-linux-aur)

Vicinae is available on the Arch User Repository (AUR) in three variants:

- **Source build**
  - [vicinae](https://aur.archlinux.org/packages/vicinae) – stable release, compiled from source
  - [vicinae-git](https://aur.archlinux.org/packages/vicinae-git) – latest development version, compiled from source

- **Prebuilt binary**
  - [vicinae-bin](https://aur.archlinux.org/packages/vicinae-bin) – stable release, precompiled binary

You can install Vicinae using your preferred AUR helper.

```
yay -S vicinae-bin
```

CopyCopied!

## [Gentoo](#gentoo)

### [jaredallard's overlay](#jaredallards-overlay)

Thanks to [jaredallard](https://github.com/jaredallard) for providing an [ebuild](https://github.com/jaredallard/overlay/tree/main/gui-apps/vicinae)!

```
eselect repository add jaredallard-overlay git https://github.com/jaredallard/overlay.git
emerge --sync jaredallard-overlay
emerge gui-apps/vicinae
```

CopyCopied!

## [Fedora](#fedora)

VIcinae is packaged on [COPR](https://copr.fedorainfracloud.org/coprs/quadratech188/vicinae/).

```
dnf copr enable quadratech188/vicinae
dnf install vicinae
```

CopyCopied!

Was this page helpful?

YesNo

[Previous](/)[Introduction](/)

[Next](/install/script)[Install from script](/install/script)

© Copyright 2026. All rights reserved.

[Follow us on GitHub](https://github.com/vicinaehq)

## On this page

- [Arch Linux (AUR)](#arch-linux-aur)
- [Gentoo](#gentoo)
  - [jaredallard's overlay](#jaredallards-overlay)
- [Fedora](#fedora)
