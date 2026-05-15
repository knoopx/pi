import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";
import { formatOutput, DEFAULT_TIMEOUT } from "./helpers";

// Port of local/tools/shell_session.py. Two backends implemented:
//   1. tmux-proxy — when LITTLE_CODER_TB_MODE=1, route every command to the
//      parent TB adapter over the extension_ui_request channel. The parent
//      drives the actual TmuxSession so commands appear in TB's trajectory.
//   2. subprocess — child_process.execSync for local use (GAIA doesn't use
//      ShellSession; this is for local REPL + debugging of TB adapter).
//
// The sentinel-prompt pexpect backend from the Python version (persistent
// bash process with state between calls) is deliberately skipped because
// neither Terminal-Bench nor GAIA requires it; TB uses tmux, GAIA uses Bash.

const TB_MODE_ENV = "LITTLE_CODER_TB_MODE";
const TB_PROXY_PREFIX = "__LC_TB_SHELL__:";

function inTbMode(): boolean {
  return process.env[TB_MODE_ENV] === "1";
}

function clampTimeout(raw: number): number {
  return Math.max(5, Math.min(raw, 600));
}

async function runCommand(
  ctx: ExtensionContext,
  cmd: string,
  timeoutSec: number,
): Promise<string> {
  return inTbMode()
    ? await execTmuxProxy(ctx, cmd, timeoutSec)
    : await execSubprocess(cmd, timeoutSec);
}

function extractOutput(err: unknown): string {
  return (
    (err as { stdout?: { toString?: () => string } })?.stdout?.toString?.() ??
    (err as { stderr?: { toString?: () => string } })?.stderr?.toString?.() ??
    ""
  );
}

function parseExecError(err: unknown): {
  output: string;
  code: number;
  timedOut: boolean;
} {
  const timedOut =
    (err as { code?: string }).code === "ETIMEDOUT" ||
    (err as { signal?: string }).signal === "SIGTERM";
  const code =
    typeof (err as { status?: number }).status === "number"
      ? (err as { status: number }).status!
      : -1;
  return { output: extractOutput(err), code, timedOut };
}

async function execSubprocess(
  command: string,
  timeoutSec: number,
): Promise<string> {
  try {
    const buf = execSync(command, {
      shell: "/bin/bash",
      timeout: timeoutSec * 1000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return formatOutput(
      String(buf),
      0,
      process.cwd(),
      false,
      "backend=subprocess",
    );
  } catch (err: unknown) {
    const { output, code, timedOut } = parseExecError(err);
    return formatOutput(
      output,
      code,
      process.cwd(),
      timedOut,
      "backend=subprocess",
    );
  }
}

async function execTmuxProxy(
  ctx: ExtensionContext,
  command: string,
  timeoutSec: number,
): Promise<string> {
  const payload = {
    op: "run",
    command,
    timeout: timeoutSec,
  };
  // Use ctx.ui.input as a generic data-carrying channel. The Python TB adapter
  // intercepts extension_ui_request with title prefix __LC_TB_SHELL__ and
  // responds with the formatted tool output string.
  const title = TB_PROXY_PREFIX + JSON.stringify(payload);
  const response = await ctx.ui.input(title, "");
  if (typeof response === "string") return response;
  return formatOutput(
    "Error: tmux proxy returned no response",
    -1,
    "?",
    true,
    "backend=tmux-proxy",
  );
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "shell-session",
    label: "Shell Session",
    description:
      "Run a command in a persistent bash session. cd, env vars, and shell state " +
      "persist across calls. One command per turn. Default timeout 30s (increase to " +
      "120-300 for installs/builds). Output is line-capped with head/tail truncation " +
      "and a trailing [exit=N cwd=… timed_out=…] footer.",
    parameters: Type.Object({
      command: Type.String({ description: "Shell command to run" }),
      timeout: Type.Optional(
        Type.Integer({ description: "Seconds (default 30, max 600)" }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cmd = String(params.command ?? "").trim();
      if (!cmd) {
        return {
          content: [{ type: "text", text: "Error: command is required" }],
          details: {},
          isError: true,
        };
      }
      const timeoutSec = clampTimeout(
        typeof params.timeout === "number" ? params.timeout : DEFAULT_TIMEOUT,
      );
      const text = await runCommand(ctx, cmd, timeoutSec);
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  pi.registerTool({
    name: "shell-session-cwd",
    label: "Shell Session CWD",
    description: "Print the current working directory of the shell session.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      let text: string;
      if (inTbMode()) {
        text = await execTmuxProxy(ctx, "pwd", 5);
      } else {
        text = await execSubprocess("pwd", 5);
      }
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  pi.registerTool({
    name: "shell-session-reset",
    label: "Shell Session Reset",
    description:
      "Kill and restart the bash session. Use only if it becomes unresponsive.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      if (inTbMode()) {
        const payload = { op: "reset" };
        await ctx.ui.input(TB_PROXY_PREFIX + JSON.stringify(payload), "");
        return {
          content: [
            {
              type: "text",
              text: `Session unstuck and reinitialized.`,
            },
          ],
          details: {},
        };
      }
      // Subprocess backend is stateless — reset is a no-op
      return {
        content: [
          {
            type: "text",
            text: `Session reset (subprocess backend is stateless).`,
          },
        ],
        details: {},
      };
    },
  });
}
