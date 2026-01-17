import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "github-repository-info",
    label: "GitHub Repository Info",
    description: `Retrieve detailed information about a GitHub repository.

Use this to:
- Check repository statistics and metadata
- Get information about stars, forks, and contributors
- View repository description and topics
- Access repository URLs and clone information

Returns comprehensive repository details from the GitHub API.`,
    parameters: Type.Object({
      owner: Type.String({
        description: "Repository owner (username or organization)",
      }),
      repo: Type.String({ description: "Repository name" }),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { owner, repo } = params as { owner: string; repo: string };
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
        );
        if (!response.ok) {
          throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`,
          );
        }
        const data = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          details: { data },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching repository info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "github-user-info",
    label: "GitHub User Info",
    description: `Get profile information about a GitHub user.

Use this to:
- View user bio and location
- Check follower/following counts
- See public repository statistics
- Access user profile URLs

Returns detailed user profile data from GitHub.`,
    parameters: Type.Object({
      username: Type.String({ description: "GitHub username" }),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { username } = params as { username: string };
      try {
        const response = await fetch(
          `https://api.github.com/users/${username}`,
        );
        if (!response.ok) {
          throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`,
          );
        }
        const data = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          details: { data },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching user info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "github-repository-issues",
    label: "GitHub Repository Issues",
    description: `Fetch issues from a GitHub repository.

Use this to:
- Monitor project issues and bug reports
- Track development progress
- Find feature requests and discussions
- Analyze repository activity

Supports filtering by state (open/closed/all).`,
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner" }),
      repo: Type.String({ description: "Repository name" }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("closed"), Type.Literal("all")],
          { default: "open" },
        ),
      ),
      per_page: Type.Optional(
        Type.Number({ minimum: 1, maximum: 100, default: 30 }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const {
        owner,
        repo,
        state = "open",
        per_page = 30,
      } = params as {
        owner: string;
        repo: string;
        state?: string;
        per_page?: number;
      };
      try {
        const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=${per_page}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`,
          );
        }
        const data = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          details: { data, count: Array.isArray(data) ? data.length : 0 },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching issues: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "github-raw-file",
    label: "GitHub Raw File",
    description: `Download the raw content of a file from GitHub.

Use this to:
- Access source code files directly
- Download configuration files
- Retrieve documentation or README files
- Get files from specific branches or commits

Returns the file content as plain text.`,
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner" }),
      repo: Type.String({ description: "Repository name" }),
      path: Type.String({ description: "Path to the file in the repository" }),
      ref: Type.Optional(
        Type.String({
          description:
            "Branch, tag, or commit SHA (defaults to default branch)",
        }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { owner, repo, path, ref } = params as {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      };
      try {
        let url = `https://raw.githubusercontent.com/${owner}/${repo}/${
          ref || "HEAD"
        }/${path}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `GitHub raw file error: ${response.status} ${response.statusText}`,
          );
        }
        const content = await response.text();
        return {
          content: [{ type: "text", text: content }],
          details: { url, contentLength: content.length },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching raw file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "search-github-repositories",
    label: "Search GitHub Repositories",
    description: `Search for repositories on GitHub using advanced queries.

Use this to:
- Find projects by language or topic
- Discover popular or trending repositories
- Locate libraries and frameworks
- Research similar projects

Supports sorting by stars, forks, or update date.`,
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (e.g., 'language:javascript stars:>1000')",
      }),
      sort: Type.Optional(
        Type.Union(
          [
            Type.Literal("stars"),
            Type.Literal("forks"),
            Type.Literal("updated"),
          ],
          { default: "stars" },
        ),
      ),
      order: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
          default: "desc",
        }),
      ),
      per_page: Type.Optional(
        Type.Number({ minimum: 1, maximum: 100, default: 30 }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const {
        query,
        sort = "stars",
        order = "desc",
        per_page = 30,
      } = params as {
        query: string;
        sort?: string;
        order?: string;
        per_page?: number;
      };
      try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.github.com/search/repositories?q=${encodedQuery}&sort=${sort}&order=${order}&per_page=${per_page}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `GitHub search API error: ${response.status} ${response.statusText}`,
          );
        }
        const data = await response.json();
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          details: { data, totalCount: (data as any).total_count || 0 },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching repositories: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
          details: {},
        };
      }
    },
  });
}
