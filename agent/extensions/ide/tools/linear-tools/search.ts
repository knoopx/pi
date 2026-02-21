/**
 * linear-search - Search Linear issues
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { errorResult, textResult } from "../../../../shared/tool-utils.js";
import {
  getLinearApiKey,
  linearGraphQL,
} from "../../components/linear-issues-component.js";
import {
  formatLinearIssueForAgent,
  LinearIssue,
} from "../../components/shared-utils.js";

interface LinearIssueQueryResult {
  issues: {
    nodes: LinearIssue[];
  };
}

export function registerLinearSearch(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "linear-search",
    label: "Linear Search",
    description:
      "Search Linear issues. Returns a list of issues matching the query.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description: "Search query (searches title and description)",
        }),
      ),
      assignedToMe: Type.Optional(
        Type.Boolean({ description: "Filter to issues assigned to me" }),
      ),
      state: Type.Optional(
        Type.String({
          description: "Filter by state name (e.g., 'In Progress', 'Done')",
        }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of results (default: 20)" }),
      ),
    }),

    async execute(_toolCallId, params) {
      const apiKey = getLinearApiKey();
      if (!apiKey) {
        return errorResult("Not logged in to Linear. Run /linear-login first.");
      }

      const limit = params.limit ?? 20;
      const filters: string[] = [];

      if (params.query) {
        filters.push(
          `{ or: [{ title: { containsIgnoreCase: "${params.query}" } }, { description: { containsIgnoreCase: "${params.query}" } }] }`,
        );
      }
      if (params.assignedToMe) {
        filters.push(`{ assignee: { isMe: { eq: true } } }`);
      }
      if (params.state) {
        filters.push(
          `{ state: { name: { eqIgnoreCase: "${params.state}" } } }`,
        );
      }

      const filterClause =
        filters.length > 0 ? `filter: { and: [${filters.join(", ")}] },` : "";

      const query = `
        query SearchIssues {
          issues(first: ${limit}, ${filterClause} orderBy: updatedAt) {
            nodes {
              id identifier title description priority url
              state { name type }
              team { key name }
              assignee { name displayName }
            }
          }
        }
      `;

      try {
        const data = await linearGraphQL<LinearIssueQueryResult>(apiKey, {
          query,
        });
        const issues = data.issues.nodes;

        if (issues.length === 0) {
          return textResult("No issues found.");
        }

        const text = issues.map(formatLinearIssueForAgent).join("\n\n");
        return textResult(`Found ${issues.length} issue(s):\n\n${text}`, {
          issues,
        });
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("linear-search"));
      if (args.query) text += theme.fg("muted", ` "${args.query}"`);
      if (args.assignedToMe) text += theme.fg("dim", " (mine)");
      if (args.state) text += theme.fg("dim", ` state:${args.state}`);
      return new Text(text, 0, 0);
    },
  });
}
