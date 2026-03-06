/**
 * linear-update-issue - Update a Linear issue (requires confirmation)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import {
  dangerousOperationConfirmation,
  errorResult,
  textResult,
} from "../../../../shared/tool-utils.js";
import { linearGraphQL } from "../../api/linear";
import { PriorityParam, requireLinearAuth } from "./common.js";

interface LinearUpdateResult {
  issueUpdate: {
    success: boolean;
    issue: { id: string; identifier: string; title: string } | null;
  };
}

export function registerLinearUpdateIssue(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "linear-update-issue",
    label: "Linear Update Issue",
    description: "Update an existing Linear issue. Requires user confirmation.",
    parameters: Type.Object({
      identifier: Type.String({
        description: "Issue identifier (e.g., 'ENG-123')",
      }),
      title: Type.Optional(Type.String({ description: "New title" })),
      description: Type.Optional(
        Type.String({ description: "New description (markdown)" }),
      ),
      state: Type.Optional(
        Type.String({
          description: "New state name (e.g., 'In Progress', 'Done')",
        }),
      ),
      priority: PriorityParam,
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const auth = requireLinearAuth();
      if (typeof auth !== "string") return auth;
      const apiKey = auth;

      // Validate required parameters
      if (!params.identifier) {
        return errorResult(
          "Missing required parameter: identifier is mandatory.",
        );
      }

      // Build list of changes
      const changes: string[] = [];
      if (params.title) changes.push(`title: "${params.title}"`);
      if (params.description) changes.push(`description: (updated)`);
      if (params.state) changes.push(`state: ${params.state}`);
      if (params.priority !== undefined)
        changes.push(`priority: ${params.priority}`);

      if (changes.length === 0) {
        return errorResult("No changes specified.");
      }

      // Require confirmation
      const denied = await dangerousOperationConfirmation(
        ctx,
        "Update Linear Issue",
        `Update ${params.identifier}?\n\nChanges:\n${changes.map((c) => `  - ${c}`).join("\n")}`,
      );
      if (denied) return denied;

      try {
        // Get issue ID from identifier
        const getQuery = `query GetIssue($id: String!) { issue(id: $id) { id } }`;
        const issueData = await linearGraphQL<{ issue: { id: string } | null }>(
          apiKey,
          {
            query: getQuery,
            variables: { id: params.identifier },
          },
        );

        if (!issueData.issue) {
          return errorResult(`Issue ${params.identifier} not found.`);
        }

        // Build mutation input
        const input: Record<string, unknown> = {};
        if (params.title) input.title = params.title;
        if (params.description) input.description = params.description;
        if (params.priority !== undefined) input.priority = params.priority;

        // Handle state change if specified
        if (params.state) {
          const statesQuery = `query { workflowStates { nodes { id name } } }`;
          const statesData = await linearGraphQL<{
            workflowStates: { nodes: { id: string; name: string }[] };
          }>(apiKey, { query: statesQuery });
          const state = statesData.workflowStates.nodes.find(
            (s) => s.name.toLowerCase() === params.state!.toLowerCase(),
          );
          if (!state) {
            return errorResult(`State '${params.state}' not found.`);
          }
          input.stateId = state.id;
        }

        const mutation = `
          mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue { id identifier title }
            }
          }
        `;

        const data = await linearGraphQL<LinearUpdateResult>(apiKey, {
          query: mutation,
          variables: { id: issueData.issue.id, input },
        });

        if (!data.issueUpdate.success || !data.issueUpdate.issue) {
          return errorResult("Failed to update issue.");
        }

        const issue = data.issueUpdate.issue;
        return textResult(`Updated ${issue.identifier}: ${issue.title}`, {
          issue,
        });
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      let text =
        theme.fg("toolTitle", theme.bold("linear-update-issue")) +
        theme.fg("muted", ` ${args.identifier}`);
      if (args.title)
        text += theme.fg("dim", ` title:"${args.title.slice(0, 30)}..."`);
      if (args.state) text += theme.fg("dim", ` state:${args.state}`);
      return new Text(text, 0, 0);
    },
  });
}
