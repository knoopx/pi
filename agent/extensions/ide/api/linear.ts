/**
 * Linear API client.
 *
 * Extracted from linear-issues-.ts for separation of concerns.
 */

const LINEAR_API_URL = "https://api.linear.app/graphql";

export interface LinearApiResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

interface LinearState {
  id: string;
  name: string;
  type: string;
  color: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  state: LinearState;
  team: { key: string };
}

export interface CreateIssueResult {
  identifier: string;
  url: string;
}

/**
 * Execute a GraphQL request against the Linear API.
 */
export async function linearGraphQL<T>(
  apiKey: string,
  body: { query: string; variables?: Record<string, unknown> },
): Promise<T> {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Linear API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as LinearApiResponse<T>;

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? "Linear API request failed");
  }

  if (!payload.data) {
    throw new Error("Linear API returned no data");
  }

  return payload.data;
}

/**
 * Check if an issue is in an active (non-completed) state.
 */
export function isIssueActive(stateType: string): boolean {
  return stateType !== "completed" && stateType !== "canceled";
}

/**
 * Fetch all teams from Linear.
 */
export async function fetchLinearTeams(apiKey: string): Promise<LinearTeam[]> {
  const query = `
    query IdeLinearTeams {
      teams {
        nodes {
          id
          key
          name
        }
      }
    }
  `;

  interface TeamsQueryData {
    teams: { nodes: LinearTeam[] };
  }

  const data = await linearGraphQL<TeamsQueryData>(apiKey, { query });
  return data.teams.nodes;
}

/**
 * Create a new issue in Linear.
 */
export async function createLinearIssue(
  apiKey: string,
  teamId: string,
  title: string,
): Promise<CreateIssueResult> {
  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  interface CreateIssueData {
    issueCreate: {
      success: boolean;
      issue: { id: string; identifier: string; url: string } | null;
    };
  }

  const data = await linearGraphQL<CreateIssueData>(apiKey, {
    query: mutation,
    variables: { input: { teamId, title } },
  });

  if (!data.issueCreate.success || !data.issueCreate.issue) {
    throw new Error("Failed to create issue");
  }

  return {
    identifier: data.issueCreate.issue.identifier,
    url: data.issueCreate.issue.url,
  };
}

/**
 * Update an existing issue in Linear.
 */
export async function updateLinearIssue(
  apiKey: string,
  issueId: string,
  title: string,
): Promise<void> {
  const mutation = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          title
        }
      }
    }
  `;

  interface UpdateIssueData {
    issueUpdate: {
      success: boolean;
      issue: { id: string; title: string } | null;
    };
  }

  const data = await linearGraphQL<UpdateIssueData>(apiKey, {
    query: mutation,
    variables: { id: issueId, input: { title } },
  });

  if (!data.issueUpdate.success) {
    throw new Error("Failed to update issue");
  }
}

/**
 * Fetch issues from Linear with viewer information.
 */
export async function fetchLinearIssues(apiKey: string): Promise<{
  viewerId: string;
  issues: LinearIssue[];
}> {
  const query = `
    query IdeLinearOverlayIssues($first: Int!) {
      viewer {
        id
      }
      issues(first: $first, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          description
          priority
          url
          createdAt
          updatedAt
          creator {
            id
            name
          }
          assignee {
            id
            name
          }
          state {
            id
            name
            type
            color
          }
          team {
            key
          }
        }
      }
    }
  `;

  interface IssuesQueryData {
    viewer: { id: string };
    issues: { nodes: LinearIssue[] };
  }

  const data = await linearGraphQL<IssuesQueryData>(apiKey, {
    query,
    variables: { first: 100 },
  });

  return {
    viewerId: data.viewer.id,
    issues: data.issues.nodes,
  };
}
