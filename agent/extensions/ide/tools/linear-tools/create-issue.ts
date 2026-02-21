/**
 * linear-create-issue - Create a new Linear issue (requires confirmation)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { errorResult, textResult } from "../../../../shared/tool-utils.js";
import { linearGraphQL } from "../../components/linear-issues-component.js";
import { PriorityParam, requireLinearAuth } from "./common.js";

interface LinearCreateResult {
  issueCreate: {
    success: boolean;
    issue: {
      id: string;
      identifier: string;
      url: string;
      title: string;
    } | null;
  };
}

interface LinearTeamsResult {
  teams: { nodes: { id: string; key: string; name: string }[] };
}

/**
 * Helper function to get team ID from team key
 */
async function getTeamId(
  apiKey: string,
  teamKey: string | null,
): Promise<string> {
  const teamsQuery = `query { teams(first: ${teamKey ? 100 : 1}) { nodes { id key } } }`;
  const teamsData = await linearGraphQL<LinearTeamsResult>(apiKey, {
    query: teamsQuery,
  });

  if (teamKey) {
    const team = teamsData.teams.nodes.find(
      (t) => t.key.toLowerCase() === teamKey.toLowerCase(),
    );
    if (!team) {
      throw new Error(`Team '${teamKey}' not found.`);
    }
    return team.id;
  }

  if (teamsData.teams.nodes.length === 0) {
    throw new Error("No teams found.");
  }
  return teamsData.teams.nodes[0].id;
}

export function registerLinearCreateIssue(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "linear-create-issue",
    label: "Linear Create Issue",
    description: "Create a new Linear issue. Requires user confirmation.",
    parameters: Type.Object({
      title: Type.String({ description: "Issue title" }),
      description: Type.Optional(
        Type.String({ description: "Issue description (markdown)" }),
      ),
      teamKey: Type.Optional(
        Type.String({
          description:
            "Team key (e.g., 'ENG'). Uses first team if not specified.",
        }),
      ),
      priority: PriorityParam,
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const auth = requireLinearAuth();
      if (typeof auth !== "string") return auth;
      const apiKey = auth;

      // Validate required parameters
      if (!params.title || !params.teamKey) {
        return errorResult(
          "Missing required: title and teamKey are mandatory.",
        );
      }

      // Require confirmation via UI
      if (ctx.hasUI) {
        const confirmed = await ctx.ui.confirm(
          "Create Linear Issue",
          `Create issue: "${params.title}"?`,
        );
        if (!confirmed) {
          return textResult("Issue creation cancelled by user.");
        }
      }

      try {
        // Get team ID
        const teamId = await getTeamId(apiKey, params.teamKey || null);

        const mutation = `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue { id identifier url title }
            }
          }
        `;

        const input: Record<string, unknown> = {
          teamId,
          title: params.title,
        };
        if (params.description) input.description = params.description;
        if (params.priority !== undefined) input.priority = params.priority;

        const data = await linearGraphQL<LinearCreateResult>(apiKey, {
          query: mutation,
          variables: { input },
        });

        if (!data.issueCreate.success || !data.issueCreate.issue) {
          return errorResult("Failed to create issue.");
        }

        const issue = data.issueCreate.issue;
        return textResult(
          `Created ${issue.identifier}: ${issue.title}\nURL: ${issue.url}`,
          { issue },
        );
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("linear-create-issue")) +
          theme.fg("muted", ` "${args.title}"`),
        0,
        0,
      );
    },
  });
}
