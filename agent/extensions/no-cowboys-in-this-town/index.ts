import type {
  ExtensionAPI,
  UserBashEventResult,
} from "@mariozechner/pi-coding-agent";
import ignore from "ignore";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const groundingTools = [
  "code-map",
  "code-query",
  "code-inspect",
  "code-callers",
  "code-callees",
  "code-trace",
  "code-deps",
];

// Commands that start interactive processes or development servers
const interactiveCommands = [
  // Development servers
  "npm start",
  "yarn start",
  "yarn dev",
  "pnpm dev",
  "pnpm start",
  "bun dev",
  "bun start",
  "rails server",
  "rails s",
  "python manage.py runserver",
  "python -m http.server",
  "python -m SimpleHTTPServer", // Python 2
  "django-admin runserver",
  "flask run",
  "uvicorn",
  "fastapi",
  "gunicorn",
  "webpack-dev-server",
  "vite",
  "next dev",
  "nuxt dev",
  "vue-cli-service serve",
  "react-scripts start",
  "create-react-app",
  "parcel",
  "snowpack",
  "rollup",
  "tsc --watch",
  "nodemon",
  "forever",
  "pm2",
  "supervisor",

  // Interactive TUIs and editors
  "vim",
  "nvim",
  "nano",
  "emacs",
  "code",
  "subl",
  "atom",
  "htop",
  "top",
  "iotop",
  "nmon",
  "glances",
  "tmux", // tmux itself is ok, but interactive sessions should be tmux new-session
  "screen",
  "byobu",

  // Database clients
  "psql",
  "mysql",
  "sqlite3",
  "redis-cli",
  "mongo",
  "mongosh",

  // Shells (prevent nested shells)
  "bash",
  "zsh",
  "fish",
  "sh",

  // Long-running services
  "nginx",
  "apache2",
  "httpd",
  "sshd",
  "docker run", // unless -d is used
  "kubectl port-forward",
  "minikube tunnel",
];

// Function to check if a command is interactive
function isInteractiveCommand(command: string): boolean {
  const cmd = command.trim().toLowerCase();

  // Check exact matches first
  if (interactiveCommands.some((ic) => cmd === ic.toLowerCase())) {
    return true;
  }

  // Check for command prefixes
  if (
    interactiveCommands.some((ic) => cmd.startsWith(ic.toLowerCase() + " "))
  ) {
    return true;
  }

  // Special cases for scripts that might be interactive
  if (cmd.includes("dev") || cmd.includes("serve") || cmd.includes("server")) {
    // Allow if it's clearly a build script (e.g., "npm run build")
    if (
      cmd.includes("run build") ||
      cmd.includes("run test") ||
      cmd.includes("run lint")
    ) {
      return false;
    }
    return true;
  }

  // Check for watch mode
  if (cmd.includes("--watch") || cmd.includes("-w")) {
    return true;
  }

  return false;
}

export default function (pi: ExtensionAPI) {
  let groundingDone = false;
  let gitignoreIg: ReturnType<typeof ignore> | null = null;

  // Function to load .gitignore files
  async function loadGitignoreRules() {
    if (gitignoreIg) return gitignoreIg;

    gitignoreIg = ignore();

    try {
      // Find all .gitignore files in the project
      const gitignoreFiles = await findGitignoreFiles(".");

      for (const file of gitignoreFiles) {
        try {
          const content = readFileSync(file, "utf8");
          if (content) {
            gitignoreIg.add(content);
          }
        } catch {
          // No .gitignore here
        }
      }
    } catch {
      // If we can't load gitignore files, just continue without them
    }

    return gitignoreIg;
  }

  // Helper to find all .gitignore files recursively
  async function findGitignoreFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      // Check for .gitignore in current directory
      const gitignorePath =
        dir === "." ? ".gitignore" : join(dir, ".gitignore");
      try {
        readFileSync(gitignorePath);
        files.push(gitignorePath);
      } catch {
        // No .gitignore here
      }

      // Recursively check subdirectories (simplified - only go one level deep for now)
      // In a real implementation, you'd want to traverse all directories
      // But for simplicity, we'll just check the root .gitignore for now
    } catch {
      // Ignore errors
    }

    return files;
  }

  // Check if a path is ignored by gitignore rules
  async function isPathIgnored(path: string): Promise<boolean> {
    const ig = await loadGitignoreRules();
    // Normalize path - remove leading ./ if present
    const normalizedPath = path.replace(/^\.\//, "");
    return ig.ignores(normalizedPath);
  }

  pi.on("session_start", () => {
    groundingDone = false;
    gitignoreIg = null; // Reset gitignore cache on new session
  });

  pi.on("tool_result", (event) => {
    if (groundingTools.includes(event.toolName)) {
      groundingDone = true;
    }
  });

  pi.on("tool_call", async (event, _ctx) => {
    const path = event.input?.path;
    if (!path) return;

    // Check if path is in gitignore (and not a .gitignore file itself)
    const isIgnored = await isPathIgnored(path as string);
    const isGitignoreFile = (path as string).endsWith(".gitignore");

    if (
      (event.toolName === "read" ||
        event.toolName === "edit" ||
        event.toolName === "write") &&
      isIgnored &&
      !isGitignoreFile &&
      !groundingDone
    ) {
      return {
        block: true,
        reason: `File "${path}" is in .gitignore and cannot be accessed until a context-grounding tool (${groundingTools.join(", ")}) has been used. Please gather context first.`,
      };
    }
  });

  pi.on(
    "user_bash",
    async (event: any, _ctx: any): Promise<UserBashEventResult | void> => {
      const command = event.command.trim();

      if (isInteractiveCommand(command)) {
        return {
          result: {
            output: `❌ Interactive command blocked: \`${command}\`\n\nThis command starts an interactive process, development server, or TUI that should not run in the foreground.\n\nPlease use \`tmux new-session\` to start interactive processes in a separate session:\n\`\`\`bash\ntmux new-session -s my-session "${command}"\`\`\`\n\nOr run it in the background with \`&\` if appropriate:\n\`\`\`bash\n${command} &\`\`\``,
            exitCode: 1,
            cancelled: false,
            truncated: false,
          },
        };
      }
    },
  );
}
