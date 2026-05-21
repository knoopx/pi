import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registry, skillsBaseTilde } from "../skills-registry";
import { tracker } from "../session-tracker";

/**
 * Send a hint message when a tool fails and its skill hasn't been read yet.
 */
export function setupToolResultHandler(pi: ExtensionAPI): void {
  pi.on("tool_result", async (event, _ctx) => {
    if (!event.isError) return;
    const skill = registry.getByTool(event.toolName);
    if (!skill) return;
    if (tracker.isRead(skill)) return;

    pi.sendMessage({
      customType: "skillful-failure",
      content: `Read this skill before retrying: ${skillsBaseTilde}/${skill.path}`,
      display: true,
    });
  });
}
