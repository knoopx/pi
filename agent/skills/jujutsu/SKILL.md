---
name: jujutsu
description: Work and manage Jujutsu (JJ) repositories and modifications. Use when managing version control with Jujutsu, tracking changes, resolving conflicts, rebasing, or working with bookmarks.
---

# Jujutsu Skill

## Prerequisites

- Jujutsu (jj) must be installed and available in PATH
- Repository must be a valid jj repository

## Core Concepts

- **Changes**: JJ's equivalent of commits, representing units of work
- **Working Copy**: Current state of files being modified
- **Unpublished Changes**: Mutable changes that exist locally but haven't been pushed
- **Descriptions**: Human-readable summaries of what the change accomplishes
- **Bookmarks**: JJ's version of branches for tracking lines of development

## Basic Commands

| Command                   | Description                                                                  |
| ------------------------- | ---------------------------------------------------------------------------- |
| `jj git init`             | Initialize a jj repository with git backend                                  |
| `jj st` / `jj status`     | Show working copy status                                                     |
| `jj` / `jj log`           | Show change log                                                              |
| `jj diff`                 | Show changes in working copy                                                 |
| `jj diff --git`           | Show changes in git diff format                                              |
| `jj desc` / `jj describe` | Edit the description of the current change                                   |
| `jj describe -m "..."`    | Set the description of the current change                                    |
| `jj new`                  | Create a new change on top                                                   |
| `jj new -m`               | Create a new change on top and set its description                           |
| `jj undo`                 | Undo the last jj operation                                                   |
| `jj squash`               | Move changes from the current change into its parent                         |
| `jj squash path`          | Move changes for the specified path into the parent change                   |
| `jj squash -i`            | Open a UI to select changes to move to parent                                |
| `jj abandon`              | Abandon the current change and create a new empty one in place               |
| `jj split`                | Split the current change, creating a new change with selected content on top |
| `jj commit "message"`     | Commit the current change to the Git repository (if colocated)               |

## Best Practices

1. **Update descriptions after modifications**: Always describe your working copy changes with `jj desc -m "type(scope): summary"` after making file modifications, following conventional commit format syntax. This keeps your change history meaningful and reviewable.
2. Use conventional commit format: `type(scope):<icon> <short description>` (under 50 chars)
3. Imperative mood: "Add feature" not "Added feature"
4. Include detailed bodies with context, bullet points, and references
5. Follow project conventions
6. Cover all significant modifications
7. Use icons for visual clarity (e.g., ✨ for features)

## Describing Changes

After making file modifications, it's essential to update the working copy description with a summary of the changes following conventional commit format syntax:

```bash
jj desc -m "type(scope):<icon> <short description>"
```

This creates a human-readable description of what the current change accomplishes using the conventional commit standard. Good descriptions:

- Use conventional commit message format.
- The commit message should have a short description (50 characters or less) followed by a blank line and then a longer description.
- The short description should be in the format: `<type>(<scope>):<icon> <short description>`
  - `type`: The type of change (e.g., feat, fix, docs, style, refactor, test, chore).
  - `scope`: The scope of the change (e.g., component or file name). Include this if the change is specific to a particular part of the codebase.
- `short description`: A brief summary of the change.
- The long description should provide additional context and details about the change.
  - Explain why the change was made.
  - Describe what is being used and why.
  - Include any relevant information that might be useful for understanding the change in the future.
  - Reference any related issues or pull requests at the end of the long description.


### Conventional Commit Types with Icons

- `feat`: ✨ A new feature
- `fix`: 🐛 A bug fix
- `docs`: 📝 Documentation only changes
- `style`: 💄 Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: ♻️ A code change that neither fixes a bug nor adds a feature
- `test`: ✅ Adding missing tests or correcting existing tests
- `chore`: 🔧 Changes to the build process or auxiliary tools and libraries such as documentation generation
- `perf`: ⚡️ A code change that improves performance
- `ci`: 👷 Changes to CI configuration files and scripts
- `build`: 🏗️ Changes that affect the build system or external dependencies
- `revert`: ⏪ Reverts a previous commit
- `wip`: 🚧 Work in progress
- `security`: 🔒 Security-related changes
- `i18n`: 🌐 Internationalization and localization
- `a11y`: ♿ Accessibility improvements
- `ux`: 🎨 User experience improvements
- `ui`: 🖌️ User interface changes
- `config`: 🔧 Configuration file changes
- `deps`: 📦 Dependency updates
- `infra`: 🌐 Infrastructure changes
- `init`: 🎉 Initial commit
- `analytics`: 📈 Analytics or tracking code
- `seo`: 🔍 SEO improvements
- `legal`: ⚖️ Licensing or legal changes
- `typo`: ✏️ Typo fixes
- `comment`: 💬 Adding or updating comments in the code
- `example`: 💡 Adding or updating examples
- `mock`: 🤖 Adding or updating mocks
- `hotfix`: 🚑 Critical hotfix
- `merge`: 🔀 Merging branches
- `cleanup`: 🧹 Code cleanup
- `deprecate`: 🗑️ Deprecating code or features
- `move`: 🚚 Moving or renaming files
- `rename`: ✏️ Renaming files or variables
- `split`: ✂️ Splitting files or functions
- `combine`: 🧬 Combining files or functions
- `add`: ➕ Adding files or features
- `remove`: ➖ Removing files or features
- `update`: ⬆️ Updating files or features
- `downgrade`: ⬇️ Downgrading files or features
- `patch`: 🩹 Applying patches
- `optimize`: 🛠️ Optimizing code

### Commit Message Example

```
feat(auth): ✨ Add user authentication

Added user authentication using JWT. This includes login, registration, and token verification endpoints.

- Implemented JWT-based authentication.
- Added login and registration endpoints.
- Added middleware for token verification.

Fixes #123
```

### Breaking Change Example

```
refactor(api): ♻️ Update API endpoints

Refactored the API endpoints to follow RESTful conventions. This change affects all existing API calls.

- Updated endpoint URLs to follow RESTful conventions.
- Modified request and response formats.

BREAKING CHANGE: All existing API calls need to be updated to the new endpoint URLs.
```

Use `jj log` to review descriptions and `jj desc` to edit them.

## Time Traveling

| Command                      | Description                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| `jj new --before @ -m "msg"` | Create a new change before the current one and set its description |
| `jj edit change-id`          | Move working copy to the specified change                          |
| `jj next --edit`             | Move to the next child change                                      |
| `jj edit @-`                 | Move to the parent change                                          |

## Branchless Workflow

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `jj new change-id` | Creates a new change before a given change-id |

## More on log

| Command                    | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| `jj log -r revsets`        | Applies a revset to log, similar to hg(1) (Mercurial) |
| `jj log --limit number`    | Limits log lines                                      |
| `jj log -r 'heads(all())'` | Shows all heads or forked changes at the top          |

## Merging

Note: there's no `jj checkout` nor `jj merge`, those used to exist but are now deprecated. We use `jj new ...` for everything.

| Command                    | Description                                                                  |
| -------------------------- | ---------------------------------------------------------------------------- |
| `jj new x yz -m "message"` | Create a new change by merging the specified changes and set its description |

## Rebasing

Notice: rebase always succeeds even with conflicts pending.

| Command               | Description                                          |
| --------------------- | ---------------------------------------------------- |
| `jj rebase -s o -d x` | Rebase the source change onto the destination change |

## Merge Conflicts

If a conflict is present, `jj st` will tell you on which files you need to look for conflicts and solve. Just save your file after solving and nothing else, no need to continue anything.

| Command      | Description                                  |
| ------------ | -------------------------------------------- |
| `jj resolve` | Open a UI to choose how to resolve conflicts |

## Log - Template Language

| Command                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `jj log -T 'TEMPLATE'` | Applies a template to jj log                          |
| `jj help -k templates` | Print the help doc with all template language options |

Examples:

- Format log to have commit-id, new line, description and ---- before next log entry:

  ```
  jj log -T 'commit_id ++ "\n" ++ description ++ "\n------\n"'
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
jj commit "msg"
jj bookmark create main -r @-
jj git push --bookmark main
jj op log
```

### Workflow to push to a 'new git branch'

```
jj
jj bookmark create feat/blahk -r @
jj git push --bookmark feat/blahk --allow-new --remote origin
```

To the next pushes, simply:

```
jj git push --bookmark feat/blahk
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

## Related Skills

- **typescript**: Use TypeScript in Jujutsu-managed projects for type safety and modern JavaScript development.
- **bun**: Manage JavaScript/TypeScript projects with Bun while using Jujutsu for version control.


