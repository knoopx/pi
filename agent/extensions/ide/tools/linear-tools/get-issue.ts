/**
 * linear-get-issue - Get a specific Linear issue
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { errorResult, textResult } from "../../../../shared/tool-utils.js";
import { getLinearApiKey } from "../../components/linear-issues.js";
import { linearGraphQL } from "../../api/linear";
import {
  formatLinearIssueForAgentExtended,
  type LinearIssueExtended,
} from "../../components/linear-formatting.js";

interface LinearSingleIssueResult {
  issue: LinearIssueExtended | null;
}

export function registerLinearGetIssue(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "linear-get-issue",
    label: "Linear Get Issue",
    description:
      "Get details of a specific Linear issue by identifier (e.g., 'ENG-123').",
    parameters: Type.Object({
      identifier: Type.String({
        description: "Issue identifier (e.g., 'ENG-123')",
      }),
    }),

    async execute(_toolCallId, params) {
      const apiKey = getLinearApiKey();
      if (!apiKey) {
        return errorResult("Not logged in to Linear. Run /linear-login first.");
      }

      const query = `
        query GetIssue($id: String!) {
          issue(id: $id) {
            id identifier title description priority url
            state { name type }
            team { key name }
            assignee { name displayName }
            labels { nodes { name } }
            comments(first: 10) { nodes { body user { name } } }
          }
        }
      `;

      try {
        const data = await linearGraphQL<LinearSingleIssueResult>(apiKey, {
          query,
          variables: { id: params.identifier },
        });

        if (!data.issue) {
          return errorResult(`Issue ${params.identifier} not found.`);
        }

        const text = formatLinearIssueForAgentExtended(data.issue);

        return textResult(text, { issue: data.issue });
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("linear-get-issue")) +
          theme.fg("muted", ` ${args.identifier}`),
        0,
        0,
      );
    },
  });
}
