import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";

interface BlockedCommandMessages {
  [key: string]: string;
}

interface ReadOnlyFiles {
  [key: string]: string;
}

const BLOCKED_COMMAND_MESSAGES: BlockedCommandMessages = {
  node: "`node` is blocked to ensure reproducible builds. Use `bun` (faster, more reliable) or `bunx` for running scripts. Example: `bun run dev` instead of `node server.js`",
  npm: "`npm` is blocked to ensure reproducible builds. Use `bun` (faster, more reliable) instead. Examples: `bun install` instead of `npm install`, `bun run build` instead of `npm run build`",
  npx: "`npx` is blocked to ensure reproducible builds. Use `bunx` (faster, more reliable) instead. Examples: `bunx create-react-app my-app` instead of `npx create-react-app my-app`",
  pip: "`pip` is blocked to ensure reproducible builds. Use `uv` or `uvx` for dependency management. Example: `uv add requests` instead of `pip install requests`",
  python:
    '`python` is blocked to prevent interactive REPL usage. Use `python -c "code"` for one-liners or `python script.py` for scripts. For dependency management, use `uv` or `uvx`. Virtual environment python with scripts is allowed.',
  python2:
    "`python2` is blocked (Python 2 is deprecated). Use `uv` with Python 3 for modern dependency management. Virtual environment python2 commands are allowed if needed. Example: `uv run --python 3.8 python script.py`",
  python3:
    '`python3` is blocked to prevent interactive REPL usage. Use `python3 -c "code"` for one-liners or `python3 script.py` for scripts. For dependency management, use `uv` or `uvx`. Virtual environment python3 with scripts is allowed.',
  git: "`git` write operations are blocked to prevent agents from managing version control. Only read-only commands are allowed: `git status`, `git diff`, `git show`, `git log`, `git rev-parse`.",
  nix: "Local flake paths without `path:` prefix are blocked to ensure reproducible builds. Use `path:` for local flakes (includes uncommitted changes), `github:` for remote repos, or `git+https:` for git URLs. Examples: `nix run path:./my-flake#output`, `nix run github:user/repo#output`",
  sudo: "`sudo` is blocked to prevent privilege escalation. Instruct the system administrator to perform this action on your behalf.",
  su: "`su` is blocked to prevent privilege escalation. Instruct the system administrator to perform this action on your behalf.",
  // Interactive commands that will hang
  vim: "`vim` is blocked as it launches an interactive editor. Use `read`/`write`/`edit` tools for file operations instead.",
  vi: "`vi` is blocked as it launches an interactive editor. Use `read`/`write`/`edit` tools for file operations instead.",
  nano: "`nano` is blocked as it launches an interactive editor. Use `read`/`write`/`edit` tools for file operations instead.",
  emacs:
    "`emacs` is blocked as it launches an interactive editor. Use `read`/`write`/`edit` tools for file operations instead.",
  pico: "`pico` is blocked as it launches an interactive editor. Use `read`/`write`/`edit` tools for file operations instead.",
  ed: "`ed` is blocked as it launches an interactive editor. Use `read`/`write`/`edit` tools for file operations instead.",
  less: "`less` is blocked as it launches an interactive pager. Use `read` tool or `cat` for file viewing.",
  more: "`more` is blocked as it launches an interactive pager. Use `read` tool or `cat` for file viewing.",
  most: "`most` is blocked as it launches an interactive pager. Use `read` tool or `cat` for file viewing.",
  pg: "`pg` is blocked as it launches an interactive pager. Use `read` tool or `cat` for file viewing.",
  man: "`man` is blocked as it launches an interactive manual viewer. Use web search or documentation tools instead.",
  irb: '`irb` is blocked as it launches an interactive Ruby REPL. Use `ruby -e "code"` for one-liners or `ruby script.rb` for scripts.',
  ghci: '`ghci` is blocked as it launches an interactive Haskell REPL. Use `ghc -e "code"` for one-liners or compile/run Haskell scripts.',
  ipython:
    '`ipython` is blocked as it launches an interactive Python REPL. Use `python -c "code"` for one-liners or `python script.py` for scripts.',
};

const READ_ONLY_FILES: ReadOnlyFiles = {
  "flake.lock":
    "`flake.lock` editing is blocked to ensure reproducible builds. This auto-generated file pins exact dependency versions for Nix flakes. Use `nix flake update` to safely update dependencies.",

  "package-lock.json":
    "`package-lock.json` editing is blocked to ensure reproducible builds. This auto-generated file ensures consistent npm installs. Use `bun install` or `bun update` to modify dependencies.",

  "bun.lockb":
    "`bun.lockb` editing is blocked to ensure reproducible builds. This auto-generated binary lockfile ensures consistent Bun installs. Use `bun install` or `bun update` to modify dependencies.",

  "yarn.lock":
    "`yarn.lock` editing is blocked to ensure reproducible builds. This auto-generated file ensures consistent Yarn installs. Use `yarn install` or `yarn upgrade` to modify dependencies.",

  "pnpm-lock.yaml":
    "`pnpm-lock.yaml` editing is blocked to ensure reproducible builds. This auto-generated file ensures consistent pnpm installs. Use `pnpm install` or `pnpm update` to modify dependencies.",

  "poetry.lock":
    "`poetry.lock` editing is blocked to ensure reproducible builds. This auto-generated file pins exact dependency versions for Poetry. Use `poetry install` or `poetry update` to modify dependencies.",

  "uv.lock":
    "`uv.lock` editing is blocked to ensure reproducible builds. This auto-generated file ensures consistent Python environments. Use `uv sync` or `uv lock` to modify dependencies.",

  "Cargo.lock":
    "`Cargo.lock` editing is blocked to ensure reproducible builds. This auto-generated file pins exact dependency versions for Rust. Use `cargo update` to safely update dependencies.",

  "Gemfile.lock":
    "`Gemfile.lock` editing is blocked to ensure reproducible builds. This auto-generated file ensures consistent Ruby environments. Use `bundle install` or `bundle update` to modify dependencies.",
};

const PROTECTED_PATHS: readonly string[] = [
  "**/.git/**",
  "**/.git",
  "**/node_modules/**",
  "**/node_modules",
];

const SECRET_FILES: readonly string[] = [
  // Environment files
  ".env*",
  "**/.env*",

  // Generic secrets files
  "secrets.*",
  "**/secrets.*",
  ".secrets",
  "**/.secrets",
  "credentials.*",
  "**/credentials.*",
  ".credentials",
  "**/.credentials",

  // Authentication and token files
  "*auth*",
  "**/*auth*",
  "*token*",
  "**/*token*",
  "*password*",
  "**/*password*",

  // SSL/TLS certificates and keys
  "*.pem",
  "**/*.pem",
  "*.key",
  "**/*.key",
  "*.crt",
  "**/*.crt",
  "*.cer",
  "**/*.cer",
  "*.p12",
  "**/*.p12",
  "*.pfx",
  "**/*.pfx",
  "*.jks",
  "**/*.jks",
  "*.keystore",
  "**/*.keystore",

  // AWS credentials
  ".aws/*",
  "**/.aws/*",
  ".boto",
  "**/.boto",

  // SSH keys
  "id_*",
  "**/id_*",
  ".ssh/id_*",
  "**/.ssh/id_*",
  "*.pub", // Public keys (often contain identifying info)
  "**/*.pub",

  // Configuration files that may contain secrets
  ".npmrc",
  "**/.npmrc",
  ".docker/config.json",
  "**/.docker/config.json",
  ".git-credentials",
  "**/.git-credentials",
  ".netrc",
  "**/.netrc",
  ".pgpass",
  "**/.pgpass",
  ".my.cnf",
  "**/.my.cnf",
  ".mongorc.js",
  "**/.mongorc.js",
  ".redis.conf",
  "**/.redis.conf",
  ".vault-token",
  "**/.vault-token",
  ".kube/config",
  "**/.kube/config",
  ".terraformrc",
  "**/.terraformrc",
  ".s3cfg",
  "**/.s3cfg",

  // Application-specific config files
  "config.*",
  "**/config.*",
  "settings.*",
  "**/settings.*",
  ".config",
  "**/.config",
];

const BLOCKED_COMMANDS: readonly string[] = Object.keys(
  BLOCKED_COMMAND_MESSAGES,
);
const ALLOWED_GIT_COMMANDS: readonly string[] = [
  "git diff",
  "git log",
  "git ls-files",
  "git rev-parse",
  "git show",
  "git status",
  "git branch",
  "git remote",
  "git tag",
];

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+(-rf?|--recursive)/i,
  /\b(chmod|chown)\b.*777/i,
];

async function checkDangerousCommand(
  command: string,
  ctx: ExtensionContext,
): Promise<void> {
  const isDangerous = DANGEROUS_COMMAND_PATTERNS.some((p) => p.test(command));

  if (isDangerous) {
    if (!ctx.hasUI) {
      throw new Error("Dangerous command blocked (no UI for confirmation)");
    }

    const choice = await ctx.ui.select(
      `⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`,
      ["Yes", "No"],
    );

    if (choice !== "Yes") {
      throw new Error("Blocked by user");
    }
  }
}

function checkPythonNodeCommand(command: string): void {
  if (typeof command !== "string" || typeof command.trim !== "function") return;

  const isWhichOrWhereis: boolean =
    command.includes("which") || command.includes("whereis");

  // Allow python commands from virtual environments and uv
  const venvPatterns: RegExp[] = [
    /[./\\]*\.venv[/\\]bin[/\\]python\d*/, // .venv/bin/python, .venv/bin/python3
    /[./\\]*venv[/\\]bin[/\\]python\d*/, // venv/bin/python, venv/bin/python3
    /[./\\]*env[/\\]bin[/\\]python\d*/, // env/bin/python, env/bin/python3
    /uv run python\d*/, // uv run python, uv run python3
    /uvx python\d*/, // uvx python, uvx python3
  ];

  for (const blockedCmd of BLOCKED_COMMANDS) {
    if (blockedCmd === "git" || blockedCmd === "nix") continue;

    // Check for direct command usage (first word)
    const commandParts: string[] = command.trim().split(/\s+/);
    const firstCommand: string = commandParts[0];

    // Handle environment variables (VAR=value command)
    const envVarPattern: RegExp = new RegExp(
      `^[A-Z_][A-Z0-9_]*=.*\\b${blockedCmd}\\b`,
      "i",
    );
    if (envVarPattern.test(command)) {
      throw new Error(BLOCKED_COMMAND_MESSAGES[blockedCmd]);
    }

    // Handle exec and eval wrappers
    if (firstCommand === "exec" || firstCommand === "eval") {
      // Check if any subsequent part contains blocked command
      const remainingCommand = commandParts.slice(1).join(" ");
      if (remainingCommand.includes(blockedCmd)) {
        throw new Error(BLOCKED_COMMAND_MESSAGES[blockedCmd]);
      }
    }

    // Check first command (after removing environment variables)
    let actualFirstCommand = firstCommand;
    if (firstCommand.includes("=")) {
      // Remove environment variable part
      const afterEnv = commandParts.find(
        (part, index) => index > 0 && !part.includes("="),
      );
      if (afterEnv) {
        actualFirstCommand = afterEnv;
      }
    }

    if (actualFirstCommand === blockedCmd) {
      // Special handling for python/node: allow if they have -c, -e, or script files
      if (
        blockedCmd === "python" ||
        blockedCmd === "python2" ||
        blockedCmd === "python3" ||
        blockedCmd === "node"
      ) {
        const hasNonInteractiveFlag =
          commandParts.includes("-c") || commandParts.includes("-e");
        const hasScriptFile = commandParts.some(
          (part, index) =>
            index > 0 &&
            !part.startsWith("-") &&
            (part.endsWith(".py") ||
              part.endsWith(".js") ||
              part.endsWith(".ts")),
        );

        // Check if the blocked command is mentioned in a URL (though unlikely for direct command)
        let hasInUrl = false;
        if (blockedCmd === "python") {
          hasInUrl = /["']https?:\/\/[^"']*\bpython\b[^"']*["']/g.test(command);
        } else if (blockedCmd === "python2") {
          hasInUrl = /["']https?:\/\/[^"']*\bpython2\b[^"']*["']/g.test(command);
        } else if (blockedCmd === "python3") {
          hasInUrl = /["']https?:\/\/[^"']*\bpython3\b[^"']*["']/g.test(command);
        } else if (blockedCmd === "node") {
          hasInUrl = /["']https?:\/\/[^"']*\bnode\b[^"']*["']/g.test(command);
        }

        if (!hasNonInteractiveFlag && !hasScriptFile && !hasInUrl) {
          throw new Error(BLOCKED_COMMAND_MESSAGES[blockedCmd]);
        }
      } else {
        throw new Error(BLOCKED_COMMAND_MESSAGES[blockedCmd]);
      }
    }

    // Enhanced pattern matching for complex command structures
    if (!isWhichOrWhereis) {
      // Check for blocked commands in various contexts, but skip if it's a virtual environment python
      const isVenvPython =
        blockedCmd.startsWith("python") &&
        venvPatterns.some((pattern) => pattern.test(actualFirstCommand));

      if (!isVenvPython) {
        const patterns: RegExp[] = [
          // Direct command anywhere
          new RegExp(`\\b${blockedCmd}\\b`, "g"),
          // In command substitution $(...)
          new RegExp(`\\$\\([^)]*\\b${blockedCmd}\\b[^)]*\\)`, "g"),
          // In backticks `...`
          new RegExp(`\`[^\`]*\\b${blockedCmd}\\b[^\`]*\``, "g"),
          // In quoted strings within commands
          new RegExp(`["'][^"']*\\b${blockedCmd}\\b[^"']*["']`, "g"),
          // After operators like &&, ||, ;, |
          new RegExp(`[;&|]{1,2}\\s*\\b${blockedCmd}\\b`, "g"),
          // In background execution &
          new RegExp(`\\b${blockedCmd}\\b\\s*&`, "g"),
          // With redirection
          new RegExp(`\\b${blockedCmd}\\b\\s*[<>]`, "g"),
          // Escaped characters
          new RegExp(`\\b${blockedCmd.replace(/(.)/g, "$1\\\\?")}\\b`, "g"),
        ];

        for (const pattern of patterns) {
          if (pattern.test(command)) {
            // For python/node commands, check if they have non-interactive flags or scripts
            if (
              blockedCmd === "python" ||
              blockedCmd === "python2" ||
              blockedCmd === "python3" ||
              blockedCmd === "node"
            ) {
              const cmdParts = command.split(/\s+/);
              const hasNonInteractiveFlag =
                cmdParts.includes("-c") || cmdParts.includes("-e");
              const hasScriptFile = cmdParts.some(
                (part, index) =>
                  index > 0 &&
                  !part.startsWith("-") &&
                  (part.endsWith(".py") ||
                    part.endsWith(".js") ||
                    part.endsWith(".ts")),
              );

              // Check if the blocked command is mentioned in a URL
              let hasInUrl = false;
              if (blockedCmd === "python") {
                hasInUrl = /["']https?:\/\/[^"']*\bpython\b[^"']*["']/g.test(command);
              } else if (blockedCmd === "python2") {
                hasInUrl = /["']https?:\/\/[^"']*\bpython2\b[^"']*["']/g.test(command);
              } else if (blockedCmd === "python3") {
                hasInUrl = /["']https?:\/\/[^"']*\bpython3\b[^"']*["']/g.test(command);
              } else if (blockedCmd === "node") {
                hasInUrl = /["']https?:\/\/[^"']*\bnode\b[^"']*["']/g.test(command);
              }

              if (!hasNonInteractiveFlag && !hasScriptFile && !hasInUrl) {
                throw new Error(BLOCKED_COMMAND_MESSAGES[blockedCmd]);
              }
            } else {
              // Check if any venv python patterns match in the command
              const hasVenvPython =
                blockedCmd.startsWith("python") &&
                venvPatterns.some((venvPattern) => venvPattern.test(command));
              if (!hasVenvPython) {
                throw new Error(BLOCKED_COMMAND_MESSAGES[blockedCmd]);
              }
            }
          }
        }
      }
    }
  }
}

function checkGitCommand(command: string): void {
  if (typeof command !== "string" || typeof command.trim !== "function") return;

  const commandParts: string[] = command.trim().split(/\s+/);
  const firstCommand: string = commandParts[0];

  // Handle environment variables (VAR=value git ...)
  let actualFirstCommand: string = firstCommand;
  if (firstCommand.includes("=")) {
    const afterEnv: string | undefined = commandParts.find(
      (part: string, index: number) => index > 0 && !part.includes("="),
    );
    if (afterEnv) {
      actualFirstCommand = afterEnv;
    }
  }

  // Handle exec and eval wrappers
  if (firstCommand === "exec" || firstCommand === "eval") {
    const remainingCommand = commandParts.slice(1).join(" ");
    if (remainingCommand.includes("git")) {
      // Check if it's an allowed git command
      const isAllowed = ALLOWED_GIT_COMMANDS.some((cmd) =>
        remainingCommand.trim().startsWith(cmd),
      );
      if (!isAllowed) {
        throw new Error(BLOCKED_COMMAND_MESSAGES["git"]);
      }
    }
  }

  if (actualFirstCommand === "git") {
    const isAllowed = ALLOWED_GIT_COMMANDS.some((cmd) =>
      command.trim().startsWith(cmd),
    );
    if (!isAllowed) {
      throw new Error(BLOCKED_COMMAND_MESSAGES["git"]);
    }
  }

  // Check for git commands in complex structures
  const gitPatterns: RegExp[] = [
    // In command substitution $(...)
    /\$\([^)]*git[^)]*\)/g,
    // In backticks `...`
    /`[^`]*git[^`]*`/g,
    // In quoted strings
    /["'][^"']*git[^"']*["']/g,
    // After operators like &&, ||, ;, |
    /[;&|]{1,2}\s*git/g,
    // In background execution
    /git\s*&/g,
    // With redirection
    /git\s*[<>]/g,
  ];

  for (const pattern of gitPatterns) {
    if (pattern.test(command)) {
      // Extract the git command part and check if it's allowed
      const gitMatch = command.match(/git\s+[^\s;&|`]*/);
      if (gitMatch) {
        const gitCommand = gitMatch[0];
        const isAllowed = ALLOWED_GIT_COMMANDS.some((cmd) =>
          gitCommand.startsWith(cmd),
        );
        if (!isAllowed) {
          throw new Error(BLOCKED_COMMAND_MESSAGES["git"]);
        }
      }
    }
  }
}

function checkNixCommand(command: string): void {
  if (typeof command !== "string" || typeof command.trim !== "function") return;

  const tokens: string[] = command.trim().split(/\s+/);

  // Handle exec and eval wrappers
  if (tokens[0] === "exec" || tokens[0] === "eval") {
    const remainingCommand: string = tokens.slice(1).join(" ");
    if (remainingCommand.includes("nix")) {
      // Recursively check the inner command
      checkNixCommand(remainingCommand);
    }
  }

  let nixIdx: number = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "nix" || tokens[i].endsWith("/nix")) {
      nixIdx = i;
      break;
    }
  }

  if (nixIdx >= 0) {
    const isNixRunOrBuild =
      tokens[nixIdx + 1] === "run" || tokens[nixIdx + 1] === "build";

    if (isNixRunOrBuild) {
      const args = command.split(/\s+/);
      let flakeArg: string | null = null;
      for (let i = nixIdx + 2; i < args.length; i++) {
        if (!args[i].startsWith("-")) {
          flakeArg = args[i];
          break;
        }
      }

      if (
        flakeArg &&
        !flakeArg.startsWith("path:") &&
        !flakeArg.match(/^github:/) &&
        !flakeArg.match(/^git\+https:/) &&
        (flakeArg.startsWith("./") ||
          flakeArg.startsWith("../") ||
          flakeArg.startsWith("/"))
      ) {
        throw new Error(BLOCKED_COMMAND_MESSAGES["nix"]);
      }
    }
  }

  // Check for nix commands in complex structures by extracting and validating them
  const complexPatterns: RegExp[] = [
    /\$\([^)]*nix[^)]*\)/g, // In command substitution $(...)
    /`[^\`]*nix[^\`]*`/g, // In backticks `...`
    /["'][^"']*nix[^"']*["']/g, // In quoted strings
  ];

  for (const pattern of complexPatterns) {
    const matches = command.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Extract the nix command from within the complex structure
        const nixMatch = match.match(/nix\s+(run|build)\s+([^\s;&|`"']*)/);
        if (nixMatch) {
          const command = nixMatch[1]; // "run" or "build"
          const flakeArg = nixMatch[2]; // the flake argument

          if (
            flakeArg &&
            !flakeArg.startsWith("path:") &&
            !flakeArg.match(/^github:/) &&
            !flakeArg.match(/^git\+https:/) &&
            (flakeArg.startsWith("./") ||
              flakeArg.startsWith("../") ||
              flakeArg.startsWith("/"))
          ) {
            throw new Error(BLOCKED_COMMAND_MESSAGES["nix"]);
          }
        }
      }
    }
  }
}

// Simple glob pattern matcher
function matchesGlob(pattern: string, str: string): boolean {
  // Convert glob pattern to regex
  let regexPattern = pattern
    .replace(/[.+*?^${}()|[\]\\]/g, "\\$&") // Escape regex special chars
    .replace(/\\\*\\\*\//g, "(?:.*/)?")
    .replace(/\/\\\*\\\*/g, "(?:/.*)?")
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(str);
}

function checkReadOnlyFileEdit(filePath: string): void {
  if (typeof filePath !== "string") return;
  if (!filePath) return;

  const fileName: string =
    filePath.split(/[/\\]/).pop()?.split("?")[0]?.split("#")[0] || "";

  if (READ_ONLY_FILES[fileName]) {
    throw new Error(READ_ONLY_FILES[fileName]);
  }

  for (const pattern of PROTECTED_PATHS) {
    if (matchesGlob(pattern, filePath)) {
      throw new Error(
        `Modifying path "${filePath}" is blocked by protected path pattern "${pattern}".`,
      );
    }
  }

  for (const pattern of SECRET_FILES) {
    if (matchesGlob(pattern, filePath)) {
      throw new Error(`Modifying secret file "${filePath}" is blocked.`);
    }
  }
}

function checkSecretFileRead(filePath: string): void {
  if (typeof filePath !== "string") return;
  if (!filePath) return;

  // Check the full path against glob patterns
  for (const pattern of SECRET_FILES) {
    if (matchesGlob(pattern, filePath)) {
      throw new Error(
        "`Reading secret files is blocked to prevent exposure of sensitive data including API keys, credentials, and configuration.`",
      );
    }
  }

  // Also check filename matches for backward compatibility
  const fileName: string =
    filePath.split(/[/\\]/).pop()?.split("?")[0]?.split("#")[0] || "";

  for (const pattern of SECRET_FILES) {
    if (matchesGlob(pattern, fileName)) {
      throw new Error(
        "`Reading secret files is blocked to prevent exposure of sensitive data including API keys, credentials, and configuration.`",
      );
    }
  }
}

// Check for any secret file references in shell commands
function checkSecretFileAccessCommand(command: string): void {
  if (typeof command !== "string" || typeof command.trim !== "function") return;

  const commandParts = command.trim().split(/\s+/);
  const firstCommand = commandParts[0];

  // Handle environment variables (VAR=value command)
  let actualFirstCommand = firstCommand;
  if (firstCommand.includes("=")) {
    const afterEnv = commandParts.find(
      (part, index) => index > 0 && !part.includes("="),
    );
    if (afterEnv) {
      actualFirstCommand = afterEnv;
    }
  }

  // Handle exec and eval wrappers
  if (firstCommand === "exec" || firstCommand === "eval") {
    const remainingCommand = commandParts.slice(1).join(" ");
    return checkSecretFileAccessCommand(remainingCommand);
  }

  // Check all command arguments for secret file references
  for (let i = 1; i < commandParts.length; i++) {
    const arg = commandParts[i];

    // Skip flags (arguments starting with -)
    if (arg.startsWith("-")) continue;

    // Check if this argument matches a secret file pattern
    for (const pattern of SECRET_FILES) {
      if (matchesGlob(pattern, arg)) {
        throw new Error(
          "`Reading secret files is blocked to prevent exposure of sensitive data including API keys, credentials, and configuration.`",
        );
      }
    }

    // Also check filename from path
    const fileName =
      arg.split(/[/\\]/).pop()?.split("?")[0]?.split("#")[0] || "";
    for (const pattern of SECRET_FILES) {
      if (matchesGlob(pattern, fileName)) {
        throw new Error(
          "`Reading secret files is blocked to prevent exposure of sensitive data including API keys, credentials, and configuration.`",
        );
      }
    }
  }

  // Also check for secret files in complex command structures
  const complexPatterns = [
    /\$\([^)]*\)/g, // Command substitution $(...)
    /`[^`]*`/g, // Backticks `...`
    /["'][^"']*["']/g, // Quoted strings
  ];

  for (const pattern of complexPatterns) {
    const matches = command.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Extract potential file paths from the match
        const words = match.replace(/[\$\(\)`"']/g, "").split(/\s+/);
        for (const word of words) {
          if (word && !word.startsWith("-")) {
            for (const secretPattern of SECRET_FILES) {
              if (matchesGlob(secretPattern, word)) {
                throw new Error(
                  "`Reading secret files is blocked to prevent exposure of sensitive data including API keys, credentials, and configuration.`",
                );
              }
            }
          }
        }
      }
    }
  }
}

function checkInteractiveCommand(command: string): void {
  if (typeof command !== "string" || typeof command.trim !== "function") return;

  const commandParts = command.trim().split(/\s+/);
  const firstCommand = commandParts[0];

  // Handle environment variables
  let actualFirstCommand = firstCommand;
  if (firstCommand.includes("=")) {
    const afterEnv = commandParts.find(
      (part, index) => index > 0 && !part.includes("="),
    );
    if (afterEnv) {
      actualFirstCommand = afterEnv;
    }
  }

  // Check for interactive shell flags
  if (
    (actualFirstCommand === "bash" ||
      actualFirstCommand === "zsh" ||
      actualFirstCommand === "sh") &&
    commandParts.includes("-i")
  ) {
    throw new Error(
      `Interactive shell \`${actualFirstCommand} -i\` is blocked as it launches an interactive shell that will hang. Use non-interactive commands instead.`,
    );
  }

  // Check for bare interactive commands that are blocked
  const blockedInteractiveCommands = [
    "bash",
    "zsh",
    "sh",
    "fish",
    "tcsh",
    "csh",
  ];
  if (
    blockedInteractiveCommands.includes(actualFirstCommand) &&
    commandParts.length === 1
  ) {
    throw new Error(
      `Bare shell command \`${actualFirstCommand}\` is blocked as it launches an interactive shell. Use specific commands instead.`,
    );
  }
}

function checkPrivilegeEscalationCommand(command: string): void {
  if (typeof command !== "string" || typeof command.trim !== "function") return;

  const commandParts: string[] = command.trim().split(/\s+/);
  const firstCommand: string = commandParts[0];

  // Handle environment variables (VAR=value command)
  let actualFirstCommand = firstCommand;
  if (firstCommand.includes("=")) {
    const afterEnv = commandParts.find(
      (part, index) => index > 0 && !part.includes("="),
    );
    if (afterEnv) {
      actualFirstCommand = afterEnv;
    }
  }

  // Handle exec and eval wrappers
  if (firstCommand === "exec" || firstCommand === "eval") {
    const remainingCommand = commandParts.slice(1).join(" ");
    if (remainingCommand.includes("sudo") || remainingCommand.includes("su")) {
      throw new Error(
        "Privilege escalation commands are blocked. Instruct the system administrator to perform this action on your behalf.",
      );
    }
  }

  if (actualFirstCommand === "sudo" || actualFirstCommand === "su") {
    throw new Error(BLOCKED_COMMAND_MESSAGES[actualFirstCommand]);
  }

  // Check for privilege escalation commands in complex structures
  const privilegePatterns: RegExp[] = [
    // In command substitution $(...)
    /\$\([^)]*sudo[^)]*\)/g,
    /\$\([^)]*su[^)]*\)/g,
    // In backticks `...`
    /`[^\`]*sudo[^\`]*`/g,
    /`[^\`]*su[^\`]*`/g,
    // In quoted strings within commands
    /["'][^"']*sudo[^"']*["']/g,
    /["'][^"']*su[^"']*["']/g,
    // After operators like &&, ||, ;, |
    /[;&|]{1,2}\s*sudo/g,
    /[;&|]{1,2}\s*su/g,
    // In background execution &
    /sudo\s*&/g,
    /su\s*&/g,
    // With redirection
    /sudo\s*[<>]/g,
    /su\s*[<>]/g,
  ];

  for (const pattern of privilegePatterns) {
    if (pattern.test(command)) {
      throw new Error(
        "Privilege escalation commands are blocked. Instruct the system administrator to perform this action on your behalf.",
      );
    }
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const { toolName, input } = event as any;

    try {
      if (toolName === "edit" || toolName === "write") {
        const filePath = input.path as string;
        checkReadOnlyFileEdit(filePath);
      }

      if (toolName === "read") {
        const filePath = input.path as string;
        checkSecretFileRead(filePath);
      }

      if (toolName === "bash") {
        const command = input.command as string;
        await checkDangerousCommand(command, ctx);
        checkPythonNodeCommand(command);
        checkGitCommand(command);
        checkNixCommand(command);
        checkSecretFileAccessCommand(command);
        checkPrivilegeEscalationCommand(command);
        checkInteractiveCommand(command);
      }
    } catch (e: any) {
      if (ctx.hasUI) {
        ctx.ui.notify(e.message, "error");
      }
      return { block: true, reason: e.message };
    }
  });
}
