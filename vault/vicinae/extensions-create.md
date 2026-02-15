# Create your first extension

This page explains how to create your first extension.

## Requirements

develop extensions, you will need:

- A working installation of NodeJS (>=20 recommended). If you are on Linux your package manager may have handled that for you already.
- A npm compatible package manager such as `npm` or `pnpm`. We always use `npm` in our examples.
- Basic knowledge of [TypeScript](https://www.typescriptlang.org/) and [React](https://react.dev/). No need to be an expert in order to build simple /extensions.

## Create Your Extension

The most straightforward way to create an extension is to use the Create Extension command from within Vicinae:

Fill in all the fields, then press `Shift + Enter` to create the extension:

As instructed, move to your newly created extension directory and install the required dependencies:

```
npm install
```

Once that is done, start your extension in development mode (Vicinae needs to be running):

```
npm run dev
```

If all is going well, the command should output something like this:

Your extension should now come up when searching for it in the root search:

And then open it for the first time:

Notice the `(Dev)` suffix in the navigation title. This means you are currently running the command as part of a development session.

In development mode, the extension is also updated every time you make a change to any file.

## Where to go from here

- [Learn about the file structure](/extensions/file-structure)
- [Learn about the manifest file](/extensions/manifest)
- [Explore the API reference](/extensions/api)
