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
  - [Introduction](/extensions/introduction)
  - [Create Your First Extension](/extensions/create)
  - [File Structure](/extensions/file-structure)
  - [Manifest](/extensions/manifest)
  - [Debug Raycast Extensions](/extensions/debug-raycast)
  - [API Reference](https://api-reference.vicinae.com)
  - [Create a view command](/extensions/view-command)
  - [Create a no-view command](/extensions/no-view-command)

- Sign in

# Create your first extension

This page explains how to create your first extension.

## [Requirements](#requirements)

In order to develop extensions, you will need:

- A working installation of NodeJS (>=20 recommended). If you are on Linux your package manager may have handled that for you already.
- A npm compatible package manager such as `npm` or `pnpm`. We always use `npm` in our examples.
- Basic knowledge of [TypeScript](https://www.typescriptlang.org/) and [React](https://react.dev/). No need to be an expert in order to build simple /extensions.

## [Create Your Extension](#create-your-extension)

The most straightforward way to create an extension is to use the Create Extension command from within Vicinae:

![](/extensions/create-extension.webp)

Fill in all the fields, then press `Shift + Enter` to create the extension:

![](/extensions/create-extension-success.webp)

As instructed, move to your newly created extension directory and install the required dependencies:

```
npm install
```

CopyCopied!

Once that is done, start your extension in development mode (Vicinae needs to be running):

```
npm run dev
```

CopyCopied!

If all is going well, the command should output something like this:

![](/extensions/extension-dev-logs.webp)

Your extension should now come up when searching for it in the root search:

![](/extensions/first-extension-root.webp)

And then simply open it for the first time:

![](/extensions/first-extension-running.webp)

Notice the `(Dev)` suffix in the navigation title. This means you are currently running the command as part of a development session.
In this mode, the development version of React will be used and the command will output its logs inside the console from where you started the session.

In development mode, the extension is also updated every time you make a change to any file.

## [Where to go from here](#where-to-go-from-here)

- [Learn about the file structure](/extensions/file-structure)
- [Learn about the manifest file](/extensions/manifest)
- [Explore the API reference](/extensions/api)

Was this page helpful?

YesNo

[Previous](/extensions/introduction)[Introduction](/extensions/introduction)

[Next](/extensions/file-structure)[File Structure](/extensions/file-structure)

© Copyright 2026. All rights reserved.

[Follow us on GitHub](https://github.com/vicinaehq)

## On this page

- [Requirements](#requirements)
- [Create Your Extension](#create-your-extension)
- [Where to go from here](#where-to-go-from-here)
