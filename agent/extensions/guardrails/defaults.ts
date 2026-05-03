import type { GuardrailsGroup } from "./types";

const defaults: GuardrailsGroup[] = [
  {
    group: "no-npm",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "* npm *",
        action: "block",
        reason:
          "npm is forbidden. Use Bun equivalents: `bun add`, `bun remove`, `bun run`, `bun install` (read skill: bun)",
      },
      {
        context: "command",
        pattern: "* npx *",
        action: "block",
        reason: "npx is forbidden. Use `bunx` instead (read skill: bun)",
      },
      {
        context: "command",
        pattern: "bun pm trust *",
        action: "block",
        reason:
          "modifies trusted package authors. This is a security-sensitive operation",
      },
    ],
  },
  {
    group: "vitest",
    pattern: "bun.lock",
    rules: [
      {
        context: "command",
        pattern: "bun test *",
        action: "block",
        reason:
          "`bun test` invokes Bun's built-in test runner, not Vitest. Use `bun vitest run` instead (read skill: vitest)",
      },
    ],
  },
  {
    group: "uv",
    pattern: "pyproject.toml",
    rules: [
      {
        context: "command",
        pattern: "{python,python3,pip,pip3} *",
        action: "block",
        reason:
          "this project uses uv. Use uv equivalents: `uv run`, `uv add`, `uv remove`, `uv sync` (read skill: uv)",
      },
    ],
  },
  {
    group: "no-truncate-output",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern:
          "{nix,node,python,uv,tsc,bun,cargo,cmake} * | {head,tail,grep} *",
        action: "block",
        reason:
          "piping stdout through head/tail/grep hides errors and failures. Run the command raw so the user can see the output",
      },
    ],
  },
  {
    group: "nix",
    pattern: "flake.nix",
    excludePattern: ".jj",
    rules: [
      {
        context: "command",
        pattern: "nix ? . *",
        action: "block",
        reason:
          "`.` without `path:` prefix only includes tracked files. Use `path:.` instead (read skill: nix-flakes)",
      },
      {
        context: "command",
        pattern: "{nix-hash,nix-prefetch-url} *",
        action: "block",
        reason:
          'Do not pre-compute hashes. Set hash to `""` and let the build report the correct one via `got:` errors (read skill: nix)',
      },
    ],
  },
  {
    group: "protect-paths",
    pattern: "*",
    rules: [
      {
        context: "file_name",
        pattern: ".git/**",
        action: "block",
        reason:
          "VCS internals — direct modification can corrupt history. Use git/jj commands instead",
      },
      {
        context: "file_name",
        pattern: ".jj/**",
        excludes: ".jj/workspaces/**",
        action: "block",
        reason:
          "VCS internals — direct modification can corrupt history. Use git/jj commands instead",
      },
      {
        context: "command",
        pattern: "{cat,less,head,tail,rm,mv,cp} *",
        includes: "* {*.git/*,*.jj/*} *",
        action: "block",
        reason:
          "VCS internals — direct access can corrupt history. Use git/jj commands instead",
      },
    ],
  },
  {
    group: "permission-gate",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "sudo *",
        action: "confirm",
        reason: "elevated privileges. Verify root access is needed",
      },
      {
        context: "command",
        pattern: "{sh,bash,zsh,fish} *",
        action: "confirm",
        reason: "arbitrary code execution via shell pipe. Review the content",
      },
      {
        context: "command",
        pattern: "{dd,mkfs.*} *",
        action: "confirm",
        reason: "destructive disk operation. Verify the target device",
      },
      {
        context: "command",
        pattern: "{chmod,chown} * {777,-R} *",
        action: "confirm",
        reason:
          "recursive or permissive permission change. Verify the path and mode",
      },
    ],
  },
  {
    group: "lock-files",
    pattern: "*",
    rules: [
      {
        context: "file_name",
        pattern:
          "{package-lock.json,bun.lockb,yarn.lock,pnpm-lock.yaml,poetry.lock,uv.lock,Cargo.lock,Gemfile.lock,flake.lock}",
        action: "block",
        reason:
          "lock files are auto-generated. Edit the manifest instead and run the package manager to regenerate",
      },
    ],
  },
  {
    group: "testing",
    pattern: "*.test.ts",
    rules: [
      {
        context: "file_content",
        file_pattern: "*.{js,jsx,ts,tsx,mjs,cjs}",
        pattern: ".skip(|describe.skip|xdescribe|xit(",
        action: "block",
        reason:
          "skipped tests create blind spots. Fix, delete, or use `it.todo()` instead (read skill: vitest)",
      },
    ],
  },
  {
    group: "linting",
    pattern: "eslint-config.*",
    rules: [
      {
        context: "file_content",
        file_pattern: "*.{js,jsx,ts,tsx,mjs,cjs}",
        pattern: "eslint-disable",
        action: "block",
        reason:
          "disabling lint rules hides issues. Fix the code or use inline `eslint-disable-next-line` with justification (read skill: eslint)",
      },
    ],
  },
  {
    group: "interactive",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "bun run dev *",
        action: "block",
        reason:
          "long-running server that blocks the terminal. Run in tmux instead (read skill: tmux)",
      },
      {
        context: "command",
        pattern: "vitest *",
        excludes: "* run *",
        action: "block",
        reason:
          "`vitest` without `run` starts watch mode. Use `bun vitest run` (read skill: vitest)",
      },
      {
        context: "command",
        pattern: "bun vitest *",
        excludes: "* run *",
        action: "block",
        reason:
          "`vitest` without `run` starts watch mode. Use `bun vitest run` (read skill: vitest)",
      },
      {
        context: "command",
        pattern: "tsc * {--watch,-w} *",
        action: "block",
        reason:
          "watch mode blocks the terminal. Use `tsc --noEmit` or run in tmux (read skill: tmux)",
      },
      {
        context: "command",
        pattern: "{bun,deno} repl *",
        action: "block",
        reason:
          "interactive REPL that blocks the terminal. Use `-e` flag to evaluate inline",
      },
    ],
  },
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
          "this project uses Jujutsu, not Git. jj has no worktrees — use `jj edit` and `jj new --before` instead (read skill: jujutsu)",
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
  {
    group: "podman",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "{docker,docker-compose} *",
        action: "block",
        reason: "use Podman instead of Docker (read skill: podman)",
      },
    ],
  },
  {
    group: "typescript-only",
    pattern: "tsconfig.json",
    rules: [
      {
        context: "file_name",
        pattern: "*.js",
        excludes: "eslint-config.js",
        action: "block",
        reason: "this project uses TypeScript. Create `.ts` files instead",
      },
    ],
  },
  {
    group: "gh-cli",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern:
          "gh {repo delete,repo archive,repo rename,release delete,issue delete,gist delete,run delete,label delete,secret delete,variable delete} *",
        action: "block",
        reason: "you are not allowed to manage github resources",
      },
    ],
  },
];
export default defaults;
