# FAQ

- [Latest version](https://github.com/vicinaehq/vicinae/releases/latest)
- Installation
- Quickstart
- [FAQ](/faq)
- [NixOS](/nixos)
- Manual
- Theming
- Script Commands
- Extensions
- Sign in

# FAQ

Answers to commonly asked questions.

## Vicinae is not packaged for my distribution. How should I install it?

Use the [script](/install/script) to install the AppImage version, which should work fine on most systems.

Do **not** install the AppImage directly.

## How to set a keyboard shortcut to open vicinae?

Vicinae doesn't support global shortcuts at the moment. You should use whatever is the preferred way to set global shortcuts for your environment.

## How to set a keyboard shortcut to open a specific command?

You can use [deeplinks](/deeplinks) like so:

```
vicinae vicinae://extensions/vicinae/clipboard/history
```

How you bind this to a proper keyboard shortcut is different in every environment.

## How to focus the app window instead of opening a new one?

You can change the default action that is executed for a given application from the settings window.

## How to use custom app launcher?

App launchers such as `uwsm` should be detected automatically. If that is not the case, you can specify a custom app launcher in the settings.

## Some of my apps do not launch or are in a weird state

In 99% of cases this is an environment variable issue. See item below.

## Vicinae doesn't pass X environment variable to my apps

Apps launched by vicinae inherit from the parent's environment without any modification.

## How to center the launcher window

If you have centering issues, you are probably on Gnome Wayland. The window should be explicitly centered using a tool such as Gnome Tweaks, or you can try the command below:

```
gsettings set org.gnome.mutter center-new-windows true
```

## How to blur the launcher window

Blur needs to be supported by your compositor. In such case, you should have a way to add a rule that will apply blur to the vicinae window.

This documentation contains quickstart guides for every major compositor.

## How to apply scaling

enable window scaling for Vicinae by setting the `QT_SCALE_FACTOR` environment variable to an appropriate value:

```
QT_SCALE_FACTOR=1.5 vicinae server
```

It is not recommended to set this value globally as it will force scaling for every QT app.

## The vicinae window takes a long time to appear

Make sure you are not running the unextracted AppImage directly every time you want to call `vicinae toggle`.

## How can I extend vicinae?

Three main ways, from least to most customizable:

- [dmenu mode](/dmenu)
- [script commands](/scripts/getting-started)
- [Typescript SDK](/extensions/introduction)

## How to set which terminal to use to launch terminal apps

As there is no standardized way to set a default terminal emulator on a Linux desktop system, Vicinae honors the `x-scheme-handler/terminal` as some other launchers do.

To set your default terminal in this way, run:

```
xdg-mime default {desktop_file_name}.desktop x-scheme-handler/terminal
```

Where `{desktop_file_name}` is the name of the desktop file your application maps to.

For example, to set the default terminal to Alacritty:

```
xdg-mime default Alacritty.desktop x-scheme-handler/terminal
```

## Emojis do not load

This is a [known issue](https://github.com/vicinaehq/vicinae/issues/304) when using the AppImage build (typically through the script installation).

## How to deal with read-only configuration?

Vicinae expects the main `settings.json` file to be readable AND writable since it will write configuration changes to it when things are edited from the GUI.

For now, the only solution is to use the `imports` key in this file to import your read-only config from there.

See the [configuration](https://docs.vicinae.com/config) page.

## Vicinae uses a lot of RAM

We are currently investigating excessive ram usage under specific situations.
