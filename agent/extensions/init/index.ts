import type {
  ExtensionAPI,
  OnUpdate,
  ToolContext,
} from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("init", {
    description: "Analyze codebase and create/improve AGENTS.md",
    handler: async (args: any, ctx: ToolContext) => {
      await ctx.waitForIdle();
      const templateContent = `Please analyze this codebase and create an AGENTS.md file containing:
1. Build/lint/test commands - especially for running a single test
2. Code style guidelines including imports, formatting, types, naming conventions, error handling, etc.

The file you create will be given to agentic coding agents (such as yourself) that operate in this repository. Make it about 150 lines long.
If there are Cursor rules (in .cursor/rules/ or .cursorrules) or Copilot rules (in .github/copilot-instructions.md), make sure to include them.

If there's already an AGENTS.md, improve it if it's located in \${path}

\$ARGUMENTS`;

      const path = ctx.cwd;
      const prompt = templateContent
        .replace(/\$\{path\}/g, path)
        .replace(/\$ARGUMENTS/g, args || "");

      if (ctx.hasUI) {
        ctx.ui.notify(
          "Analyzing codebase and initializing AGENTS.md...",
          "info",
        );
      }
      pi.sendUserMessage(prompt);
      await ctx.waitForIdle();
    },
  });
}
