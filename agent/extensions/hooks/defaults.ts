import type { HooksConfig } from "./schema";

const defaults: HooksConfig = [
  {
    group: "javascript",
    pattern: "*",
    hooks: [
      {
        event: "tool_result",
        context: "file_name",
        pattern: "*.{js,jsx,ts,tsx,json,css,scss,less,html,md,yaml,yml}",
        command: 'bunx prettier --write "%file%"',
        timeout: 5000,
        notify: false,
      },
    ],
  },
  {
    group: "typescript",
    pattern: "{tsconfig.json,tsconfig.*.json}",
    hooks: [
      {
        event: "tool_result",
        context: "file_name",
        pattern: "*.{ts,tsx,js,jsx}",
        command: 'bun run typecheck 2>&1 | { grep "%file%" || true; }',
        timeout: 60000,
        notify: true,
      },
    ],
  },
  {
    group: "eslint",
    pattern: "eslint.config.*",
    hooks: [
      {
        event: "tool_result",
        command: 'bunx eslint "%file%"',
        timeout: 120000,
        notify: true,
      },
    ],
  },
  {
    group: "shell",
    pattern: "*",
    hooks: [
      {
        event: "tool_result",
        context: "file_name",
        pattern: "*.{sh,bash}",
        command: 'shfmt -w "%file%"',
        timeout: 5000,
        notify: false,
      },
    ],
  },
  {
    group: "nu",
    pattern: "*",
    hooks: [
      {
        event: "tool_result",
        context: "file_name",
        pattern: "*.nu",
        command: 'nu --ide-check 10 "%file%"',
        timeout: 5000,
        notify: true,
      },
    ],
  },
  {
    group: "nix",
    pattern: "*",
    hooks: [
      {
        event: "tool_result",
        context: "file_name",
        pattern: "*.nix",
        command: 'alejandra -q "%file%"',
        timeout: 5000,
        notify: false,
      },
      {
        event: "tool_result",
        context: "file_name",
        pattern: "*.nix",
        command: 'nix-instantiate --parse "%file%"',
        timeout: 30000,
        notify: true,
      },
    ],
  },
  {
    group: "python",
    pattern: "*",
    hooks: [
      {
        event: "tool_result",
        context: "file_name",
        pattern: "*.py",
        command: 'ruff format "%file%"',
        timeout: 5000,
        notify: false,
      },
    ],
  },
];

export default defaults;
