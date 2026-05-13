import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "jj-not-git",
    pattern: ".jj",
    rules: [
      {
        context: "command",
        pattern: "git add *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. jj has no staging area — edits are immediate (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git commit *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj describe -m 'message'` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git status *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj status` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git push *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj git push` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git pull *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj git pull` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git merge *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj new x y` to create a merge change (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git branch *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj bookmark` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git checkout *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj edit` to switch changes or `jj restore` to discard (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git reset *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj abandon` or `jj undo` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git revert *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj git revert` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git stash *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. jj has no stash — use `jj squash` or `jj new` to save work (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git tag *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj bookmark create` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git init *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj git init` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git config *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Config lives in `.jj/repo/config.toml` (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git remote *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj git remote` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git fetch *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj git fetch` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git rebase *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj rebase` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git restore *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj restore` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git worktree *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. jj has no worktrees — use `jj new --before` to insert changes (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "git clean *",
        action: "block",
        reason:
          "this project uses Jujutsu, not Git. Use `jj untrack` instead (read skill: jujutsu)",
      },
    ],
  },
  {
    group: "jj",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "jj edit *",
        action: "block",
        reason:
          "do not edit existing changes. Create a new change with `jj new` and squash it with `jj squash` instead (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "jj * -r @*",
        action: "block",
        reason:
          "git-style parent syntax is deprecated. Use jj's revision syntax (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "jj {revert,restore,diffedit,simplify,forget,undo,recover} *",
        excludes: "* {--help,--file} *",
        action: "block",
        reason: "you are not allowed to manage jujutsu repositories",
      },
      {
        context: "command",
        pattern: "jj {squash,split,describe,desc,commit} *",
        excludes: "* -m *",
        action: "block",
        reason:
          "opens an editor without `-m`. Use non-interactive form with `-m 'message'` (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "jj * {-i,--interactive,--tool} *",
        excludes: "* --help *",
        action: "block",
        reason:
          "interactive flags open editors/TUIs. Use non-interactive alternatives (read skill: jujutsu)",
      },
      {
        context: "command",
        pattern: "jj git push *",
        action: "confirm",
        reason: "pushing to remote. Verify the target branch and remote",
      },
    ],
  },
  {
    group: "git-push",
    pattern: ".git",
    rules: [
      {
        context: "command",
        pattern: "git push *",
        action: "confirm",
        reason: "pushing to remote. Verify the target branch and remote",
      },
    ],
  },
];

export default defaults;
