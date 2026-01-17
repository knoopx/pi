name: jujutsu
description: A practical quick-reference for the JJ (Jujutsu) version control system. Use when learning JJ commands, navigating change history, performing merges/rebases, resolving conflicts, or working with bookmarks and remotes.
---

## Basic Commands

| Command                     | Description                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `jj git init`               | Inits jj with git backend                                                                               |
| `jj st` / `jj status`       | Prints status                                                                                           |
| `jj` / `jj log`             | Prints log                                                                                              |
| `jj diff`                   | Diffs current change                                                                                    |
| `jj diff --git`             | Diffs current change in git style                                                                       |
| `jj desc` / `jj describe`   | Adds a description to the current change                                                                |
| `jj describe -m "..."`      | Same as above, but inline                                                                               |
| `jj new`                    | Ends a change and inits a new one                                                                       |
| `jj new -m`                 | Ends a change and inits a new one setting a description                                                 |
| `jj file annotate filename` | Annotates filename, similar to git blame or hg annotate                                                 |
| `jj undo`                   | Undoes last jj command                                                                                  |
| `jj squash`                 | Combines changes and descriptions                                                                       |
| `jj squash file`            | Instantly squashes file down to last change                                                             |
| `jj squash -i`              | Opens an ui to select what to squash                                                                    |
| `jj abandon`                | Drops everything on current change and starts a new one in place                                        |
| `jj split`                  | Splits current change creating a new change with the selected content on @-                             |
| `jj commit -m "..."`        | Adds a description for current change and starts a new one (equivalent to `jj desc -m "..." && jj new`) |

## Time Traveling

| Command                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `jj new -B @ -m "msg"` | Creates a new change Before current (@) setting a description |
| `jj edit change-id`    | Moves to whatever change-id                                   |
| `jj next --edit`       | Jumps to next change                                          |
| `jj edit @+`           |                                                               |
| `jj edit @-`           | Jumps to prev change                                          |

## Branchless Workflow

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `jj new change-id` | Creates a new change before a given change-id |

## More on log

| Command                    | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| `jj log -r revsets`        | Applies a revset to log, similar to hg(1) (Mercurial) |
| `jj --limit number`        | Limits log lines                                      |
| `jj log -r 'heads(all())'` | Shows all 'heads' or 'forked' changes top change      |

## Merging

Note: there's no `jj checkout` nor `jj merge`, those used to exist but are now deprecated. We use `jj new ...` for everything.

| Command                    | Description                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `jj new x yz -m "message"` | Creates a new change by merging x and yz change ids defining a message "merge". User can merge as many change-ids as they wish. |

## Rebasing

Notice: rebase always succeeds even with conflicts pending.

| Command               | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `jj rebase -s o -d x` | Rebases change with id o (source) to change with id x (destination) |

## Merge Conflicts

If a conflict is present, `jj st` will tell you on which files you need to look for conflicts and solve. Just save your file after solving and nothing else, no need to continue anything.

| Command      | Description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `jj resolve` | Opens an ui to choose how to solve conflicts (plus: mouse is supported) |

## Log - Template Language

| Command                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `jj log -T 'TEMPLATE'` | Applies a template to jj log                          |
| `jj help -k templates` | Print the help doc with all template language options |

Examples:

- Format log to have commit-id, new line, description and ---- before next log entry:

  ```
  jj log -T 'commit-id ++ "\n" ++ description ++ "\n------\n"'
  ```

- Get short commit IDs of the working-copy parents:

  ```
  jj log --no-graph -r @ -T 'parents.map(|c| c.commit_id().short()).join(",")'
  ```

- Show machine-readable list of full commit and change IDs:
  ```
  jj log --no-graph -T 'commit_id ++ " " ++ change_id ++ "\n"'
  ```

## Log - Revset Language

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `jj log -r 'REVSET'` | Applies a revset to jj log                            |
| `jj help -k revsets` | Prints the help doc with all revsets language options |

Examples:

- Show the parent(s) of the working-copy commit (like `git log -1 HEAD`):

  ```
  jj log -r @-
  ```

- Show all ancestors of the working copy (like plain `git log`):

  ```
  jj log -r ::@
  ```

- Show commits not on any remote bookmark:

  ```
  jj log -r 'remote_bookmarks()..'
  ```

- Show commits not on `origin` (if you have other remotes like `fork`):

  ```
  jj log -r 'remote_bookmarks(remote=origin)..'
  ```

- Show the initial commits in the repo (the ones Git calls "root commits"):

  ```
  jj log -r 'root()+'
  ```

- Show some important commits (like `git --simplify-by-decoration`):

  ```
  jj log -r 'tags() | bookmarks()'
  ```

- Show local commits leading up to the working copy, as well as descendants of those commits:

  ```
  jj log -r '(remote_bookmarks()..@)::'
  ```

- Show commits authored by "martinvonz" and containing the word "reset" in the description:
  ```
  jj log -r 'author(martinvonz) & description(reset)'
  ```

## Diff - Fileset Language

| Command               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `jj help -k filesets` | Prints the help doc with all filesets language options |

Examples:

- Show diff excluding `Cargo.lock`:

  ```
  jj diff '~Cargo.lock'
  ```

- List files in `src` excluding Rust sources:

  ```
  jj file list 'src ~ glob:"**/*.rs"'
  ```

- Split a revision in two, putting `foo` into the second commit:
  ```
  jj split '~foo'
  ```

## JJ & Git - Co-locate

This means jj side by side with git. Your project will have on its root, both a `.jj` and a `.git` directory.

| Command                    | Description                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `jj git init --colocate .` | Set a new version control with both jj and git, or if git is present, make arrangements so both can be colocated. |

### Simple workflow to main branch:

```
jj log
jj commit -m "msg"
jj bookmark set --revision @- main
jj git push -r @-
jj op log
```

### Workflow to push to a 'new git branch'

```
jj
jj bookmark set -r @ 'feat/blahk'
jj git push -r @ --allow-new --remote origin
```

To the next pushes, simply:

```
jj git push -r @
```

Some other useful commands since jj/git colocated relies heavily on bookmarks:

```
jj bookmark move --from=@- --to=@
jj bookmark delete '...'
jj bookmark track main@origin
jj git push --all --deleted
```

A complete set and more examples with:

```
jj help -k bookmarks
```

Note, after performing jj motions, probably the git part of the thing will be HEADLESS or in a detached state. If you wish to perform "regular" git operations, most probably you need to first "git checkout" to a branch.

## Stageless Workflow

Jujutsu has no traditional staging area like Git. This means changes you make in your working copy are immediately part of your current change (also called a working commit). So what if you've modified 10 files but only want to "commit" 2 of them?

You can mimic partial commits with a few simple commands.

### The trick: `jj split`

Use `jj split` to break your current change into two:

```
jj split
```

This opens a TUI (Text User Interface) where you can select which files or even hunks to split into a new change.

What happens:

- The selected changes go into a **new change** (on top of your current one)
- The rest stay in the **original change**

Think of it like "staging" part of your work and "committing" it, without ever touching an index.

### Example Workflow

1. You edit `fileA.ts`, `fileB.ts`, and `fileC.ts`.
2. But you only want to commit the changes to `fileA.ts`.
3. Run:
   ```
   jj split
   ```
4. Select only `fileA.ts` in the UI.
5. Give the new change a description with:
   ```
   jj describe -m "Refactor fileA logic"
   ```

Now your `fileA.ts` changes are safely committed. You're still on the remaining changes for `fileB.ts` and `fileC.ts`.

You can repeat the process to incrementally split off changes until you're happy.

## Why JJ?

Jujutsu is a powerful version control system for software projects. You use it to get a copy of your code, track changes to the code, and finally publish those changes for others to see and use. It is designed from the ground up to be easy to use, whether you're new or experienced, working on brand new projects alone, or large scale software projects with large histories and teams.

What sets JJ apart is its focus on automatic working commits, which track your changes continuously without the usual manual commit overhead. This design makes JJ extremely fast, highly scriptable, and encourages maintaining a cleaner, more intuitive project history.

That said, JJ introduces new workflows and concepts that may feel unfamiliar at first. Common operations like merge or rebase behave differently, so keeping a quick reference handy can make your transition smoother and more productive.

This cheat sheet is not a comprehensive tutorial, it's a quick reference, a jumping-off point, and a distilled guide for navigating jj.
