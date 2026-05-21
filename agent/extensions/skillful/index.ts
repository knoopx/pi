import type {
  BeforeAgentStartEventResult,
  ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

import {
  interceptReadCall,
  checkBashCommand,
  blockToolCall,
  setupToolResultHandler,
} from "./lib/gates";
import { tracker } from "./lib/session-tracker";
import { registry } from "./lib/skills-registry";
import { buildSystemPrompt } from "./lib/system-prompt-builder";

export default function (pi: ExtensionAPI) {
  setupToolResultHandler(pi);

  pi.on("tool_call", async (event, ctx) => {
    interceptReadCall(event.input as { path?: string });

    if (event.toolName === "bash") {
      const result = checkBashCommand(
        event.input as { command?: string; bash?: string },
        ctx,
      );
      if (result) return result;
    }

    const skill = registry.getByTool(event.toolName);
    const gateResult = blockToolCall(event.toolName, skill, (s) =>
      tracker.isRead(s),
    );
    if (gateResult) {
      return gateResult;
    }
  });

  pi.on("session_start", async () => {
    tracker.reset();
  });

  // Replace the full system prompt with dynamically built tools and skills.
  pi.on(
    "before_agent_start",
    async (_event, _ctx): Promise<BeforeAgentStartEventResult> => {
      const allTools = pi.getAllTools();
      const toolList = allTools.map((t) => ({
        name: t.name,
        description: t.description,
      }));

      const allSkills = registry.getAll();
      const systemPrompt = buildSystemPrompt(toolList, allSkills);

      return { systemPrompt };
    },
  );
}
