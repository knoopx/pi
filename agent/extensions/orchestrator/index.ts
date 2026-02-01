import process from "node:child_process";
import { complete, type Context, Message } from "@mariozechner/pi-ai";
import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";

type Session = {
  id: string;
  goal: string;
};

let sessions: Session[] = [];

function spawnAndDetachInTmux(id: string, goal: string) {
  const workspacePath = `.jj/pi/${id}`;
  process.execSync(`mkdir -p "${workspacePath}"`);
  process.execSync(`jj workspace add "${workspacePath}"`);
  process.execSync(`jj -R "${workspacePath}" desc -m "${goal}"`);
  process.spawnSync("tmux", ["new-session", "-d", "-s", id, "pi", goal], {
    detached: true,
    stdio: "ignore",
  });
  sessions.push({ id, goal });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("swarm", {
    description: "Manage sessions",
    handler: async (args, ctx) => {},
  });

  pi.on("turn_end", async (ctx) => {
    // needed to jj to "snapshot" the changes on workspaces
    process.execSync("jj log", { stdio: "inherit" });
  });

  pi.registerCommand("spawn", {
    description:
      "Work on a new task using a separate Jujutsu workspace in the background",
    handler: async (args, ctx) => {
      if (!ctx.model) {
        ctx.ui.notify("No model selected", "error");
        return;
      }

      const taskDescription = args.trim();
      if (!taskDescription) {
        ctx.ui.notify("Requires a task", "error");
        return;
      }

      ctx.ui.notify(`New Feature: ${taskDescription} `, "info");

      const prompt =
        "Generate a task id `pi-<friendly-id>` and goal for the following feature `feat(scope): description`:\n\n" +
        taskDescription +
        "\n\nRespond using format:\ntask_id\tgoal";

      const conversation: Context = {
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ] as Message[],
      };

      const response = await complete(ctx.model, conversation, {
        apiKey: await ctx.modelRegistry.getApiKey(ctx.model),
      });

      const content = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      ctx.ui.notify(`Jujutsu response: ${content}`, "warning");

      if (!content) {
        ctx.ui.notify("No response from model", "error");
        return;
      }

      const [taskId, goal] = content.split("\t");

      if (!taskId || !goal) {
        ctx.ui.notify("Unexpected response format", "error");
        return;
      }

      ctx.ui.notify(
        `Created Jujutsu task ${taskId} with goal: ${goal}`,
        "info",
      );

      spawnAndDetachInTmux(taskId, goal);
    },
  });
}
