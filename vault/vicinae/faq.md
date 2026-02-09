[![logo-dark](/vicinae-dark.svg)![Logo](/vicinae.svg)](/)

Find something...`K`

[![logo-dark](/vicinae-dark.svg)![Logo](/vicinae.svg)](/)

- [Latest version](https://github.com/vicinaehq/vicinae/releases/latest)

- ## Installation
- ## Quickstart
- [FAQ](/faq)
- [NixOS](/nixos)
- ## Manual
- ## Theming
- ## Script Commands
- ## Extensions
- Sign in

# FAQ

Answers to commonly asked questions.

## [Vicinae is not packaged for my distribution. How should I install it?](#vicinae-is-not-packaged-for-my-distribution-how-should-i-install-it)

Use the [script](/install/script) to install the AppImage version, which should work fine on most systems. Don't forget to follow the quickstart guide for your environment once you are done installing.

Do **not** install the AppImage directly.

## [How to set a keyboard shortcut to open vicinae?](#how-to-set-a-keyboard-shortcut-to-open-vicinae)

Vicinae doesn't support global shortcuts at the moment. You should use whatever is the preferred way to set global shortcuts for your environment. If there is a quickstart guide for your environment, this is probably explained there.

## [How to set a keyboard shortcut to open a specific command?](#how-to-set-a-keyboard-shortcut-to-open-a-specific-command)

You can use [deeplinks](/deeplinks) like so:

```
vicinae vicinae://extensions/vicinae/clipboard/history
```

CopyCopied!

How you bind this to a proper keyboard shortcut is different in every environment. Please refer to your desktop environment's documentation.

## [How to focus the app window instead of opening a new one?](#how-to-focus-the-app-window-instead-of-opening-a-new-one)

You can change the default action that is executed for a given application from the settings window. Search for the `Applications` group and the option should be there.

## [How to use custom app launcher?](#how-to-use-custom-app-launcher)

App launchers such as `uwsm` should be detected automatically. If that is not the case, you can specify a custom app launcher in the settings.

## [Some of my apps do not launch or are in a weird state](#some-of-my-apps-do-not-launch-or-are-in-a-weird-state)

In 99% of cases this is an environment variable issue. See item below.

## [Vicinae doesn't pass X environment variable to my apps](#vicinae-doesnt-pass-x-environment-variable-to-my-apps)

Apps launched by vicinae inherit from the parent's environment without any modification. This probably means the environment variable that is missing is not properly injected in vicinae's environment when started. If using the systemd user service, you need to make sure the service is started with the right set of environment variables.

## [How to center the launcher window](#how-to-center-the-launcher-window)

If you have centering issues, you are probably on Gnome Wayland. The window should be explicitly centered using a tool such as Gnome Tweaks, or you can try the command below:

```
gsettings set org.gnome.mutter center-new-windows true
```

CopyCopied!

## [How to blur the launcher window](#how-to-blur-the-launcher-window)

Blur needs to be supported by your compositor. In such case, you should have a way to add a rule that will apply blur to the vicinae window. The class or scope you need is `vicinae`.

This documentation contains quickstart guides for every major compositor. If blur can be done, be it natively or through some kind of extension, it is likely documented on these pages.

## [How to apply scaling](#how-to-apply-scaling)

It is possible to enable window scaling for Vicinae by setting the `QT_SCALE_FACTOR` environment variable to an appropriate value:

```
QT_SCALE_FACTOR=1.5 vicinae server
```

CopyCopied!

It is not recommended to set this value globally as it will force scaling for every QT app. If you need desktop-wide scaling you probably want your Wayland compositor to handle this for you. Only use this if you only need the Vicinae window to scale up or down.

## [The vicinae window takes a long time to appear](#the-vicinae-window-takes-a-long-time-to-appear)

Make sure you are not running the unextracted AppImage directly every time you want to call `vicinae toggle`. You should probably use the [script](/install/script) to automatically extract the AppImage components.

## [How can I extend vicinae?](#how-can-i-extend-vicinae)

Three main ways, from least to most customizable:

- [dmenu mode](/dmenu)
- [script commands](/scripts/getting-started)
- [Typescript SDK](/extensions/introduction)

## [How to set which terminal to use to launch terminal apps](#how-to-set-which-terminal-to-use-to-launch-terminal-apps)

As there is no standardized way to set a default terminal emulator on a Linux desktop system, Vicinae honors the `x-scheme-handler/terminal` as some other launchers do.

To set your default terminal in this way, run:

```
xdg-mime default {desktop_file_name}.desktop x-scheme-handler/terminal
```

CopyCopied!

Where `{desktop_file_name}` is the name of the desktop file your application maps to.

For example, to set the default terminal to Alacritty:

```
xdg-mime default Alacritty.desktop x-scheme-handler/terminal
```

CopyCopied!

## [Emojis do not load](#emojis-do-not-load)

This is a [known issue](https://github.com/vicinaehq/vicinae/issues/304) when using the AppImage build (typically through the script installation). The TLDR is that QT does not recognize some fonts as emoji fonts. A fix is to try installing another emoji font and see if vicinae automatically picks it up. More complicated workarounds are also discussed in the previously mentionned issue.

## [How to deal with read-only configuration?](#how-to-deal-with-read-only-configuration)

Vicinae expects the main `settings.json` file to be readable AND writable since it will write configuration changes to it when things are edited from the GUI.

For now, the only solution is to use the `imports` key in this file to import your read-only config from there.

See the [configuration](https://docs.vicinae.com/config) page.

## [Vicinae uses a lot of RAM](#vicinae-uses-a-lot-of-ram)

We are currently investigating excessive ram usage under specific situations. If you are seeing this on the latest version of vicinae please contribute to [this issue](https://github.com/vicinaehq/vicinae/issues/998).

Was this page helpful?

YesNo

[Previous](/quickstart/generic)[General Quickstart](/quickstart/generic)

[Next](/nixos)[NixOS](/nixos)

© Copyright 2026. All rights reserved.

[Follow us on GitHub](https://github.com/vicinaehq)

## On this page

- [Vicinae is not packaged for my distribution. How should I install it?](#vicinae-is-not-packaged-for-my-distribution-how-should-i-install-it)
- [How to set a keyboard shortcut to open vicinae?](#how-to-set-a-keyboard-shortcut-to-open-vicinae)
- [How to set a keyboard shortcut to open a specific command?](#how-to-set-a-keyboard-shortcut-to-open-a-specific-command)
- [How to focus the app window instead of opening a new one?](#how-to-focus-the-app-window-instead-of-opening-a-new-one)
- [How to use custom app launcher?](#how-to-use-custom-app-launcher)
- [Some of my apps do not launch or are in a weird state](#some-of-my-apps-do-not-launch-or-are-in-a-weird-state)
- [Vicinae doesn't pass X environment variable to my apps](#vicinae-doesnt-pass-x-environment-variable-to-my-apps)
- [How to center the launcher window](#how-to-center-the-launcher-window)
- [How to blur the launcher window](#how-to-blur-the-launcher-window)
- [How to apply scaling](#how-to-apply-scaling)
- [The vicinae window takes a long time to appear](#the-vicinae-window-takes-a-long-time-to-appear)
- [How can I extend vicinae?](#how-can-i-extend-vicinae)
- [How to set which terminal to use to launch terminal apps](#how-to-set-which-terminal-to-use-to-launch-terminal-apps)
- [Emojis do not load](#emojis-do-not-load)
- [How to deal with read-only configuration?](#how-to-deal-with-read-only-configuration)
- [Vicinae uses a lot of RAM](#vicinae-uses-a-lot-of-ram)
