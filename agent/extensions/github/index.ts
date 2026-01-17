import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
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

    async execute(
      _toolCallId: string,
      params: any,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
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
        const summary = [
          `**${data.name}** by ${data.owner.login}`,
          data.description && data.description.trim()
            ? `Description: ${data.description}`
            : null,
          `Language: ${data.language || "Not specified"}`,
          `Stars: ${data.stargazers_count.toLocaleString()} | Forks: ${data.forks_count.toLocaleString()}`,
          `Issues: ${data.open_issues_count} open | License: ${data.license?.name || "None"}`,
          `Created: ${new Date(data.created_at).toLocaleDateString()} | Updated: ${new Date(data.updated_at).toLocaleDateString()}`,
          `URL: ${data.html_url}`,
          data.homepage && data.homepage.trim()
            ? `Homepage: ${data.homepage}`
            : null,
          data.topics?.length ? `Topics: ${data.topics.join(", ")}` : null,
        ]
          .filter((item) => item !== null)
          .join("\n");
        return {
          content: [{ type: "text", text: summary }],
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

    async execute(
      _toolCallId: string,
      params: any,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
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
        const summary = [
          `**${data.name || data.login}** (${data.login})`,
          data.bio && data.bio.trim() ? `Bio: ${data.bio}` : null,
          data.location && data.location.trim()
            ? `Location: ${data.location}`
            : null,
          data.company && data.company.trim()
            ? `Company: ${data.company}`
            : null,
          `Followers: ${data.followers} | Following: ${data.following}`,
          `Public repos: ${data.public_repos} | Public gists: ${data.public_gists}`,
          `Joined: ${new Date(data.created_at).toLocaleDateString()}`,
          `Profile: ${data.html_url}`,
          data.blog && data.blog.trim() ? `Website: ${data.blog}` : null,
          data.twitter_username && data.twitter_username.trim()
            ? `Twitter: @${data.twitter_username}`
            : null,
        ]
          .filter((item) => item !== null)
          .join("\n");
        return {
          content: [{ type: "text", text: summary }],
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

Supports filtering by state (open/closed/all). Limited to 10 issues by default.`,
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
        Type.Number({ minimum: 1, maximum: 20, default: 10 }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: any,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const {
        owner,
        repo,
        state = "open",
        per_page = 10,
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
        let summary = `Found ${data.length} ${state} issue${data.length !== 1 ? "s" : ""}:\n\n`;
        if (data.length === 0) {
          summary = `No ${state} issues found.`;
        } else {
          summary += data
            .map(
              (issue: any) =>
                `#${issue.number || "N/A"}: ${issue.title || "No title"} (${issue.state || "unknown"})\n` +
                `By ${issue.user?.login || "unknown"} on ${issue.created_at ? new Date(issue.created_at).toLocaleDateString() : "unknown date"}\n` +
                `Labels: ${issue.labels?.map((l: any) => l.name).join(", ") || "none"}\n` +
                `${issue.html_url || ""}\n`,
            )
            .join("\n");
        }
        return {
          content: [{ type: "text", text: summary }],
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

Returns the file content as plain text. Limited to 100KB files.`,
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

    async execute(
      _toolCallId: string,
      params: any,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
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
          let errorMessage = `GitHub raw file error: ${response.status} ${response.statusText}`;
          if (response.status === 404) {
            errorMessage +=
              ". The requested file, repository, or branch/tag/commit could not be found. Please verify the owner, repository name, file path, and reference (branch/tag/commit) are correct.";
          } else if (response.status === 403) {
            errorMessage +=
              ". This might be due to rate limiting or accessing a private repository.";
          }
          throw new Error(errorMessage);
        }
        const content = await response.text();
        const maxSize = 100 * 1024; // 100KB limit
        let truncatedContent = content;
        let wasTruncated = false;

        if (content.length > maxSize) {
          truncatedContent =
            content.substring(0, maxSize) +
            `\n\n[File truncated - ${content.length - maxSize} characters remaining]`;
          wasTruncated = true;
        }

        return {
          content: [{ type: "text", text: truncatedContent }],
          details: { url, contentLength: content.length, wasTruncated },
        };
      } catch (error) {
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${
          ref || "HEAD"
        }/${path}`;
        return {
          content: [
            {
              type: "text",
              text: `Error fetching raw file: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { url },
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

Supports sorting by stars, forks, or update date. Limited to 10 results by default.`,
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
        Type.Number({ minimum: 1, maximum: 20, default: 10 }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: any,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const {
        query,
        sort = "stars",
        order = "desc",
        per_page = 10,
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
        let summary = `Found ${data.total_count} repositories (showing ${data.items.length}):\n\n`;
        if (data.items.length === 0) {
          summary = "No repositories found matching the search criteria.";
        } else {
          summary += data.items
            .map(
              (repo: any) =>
                `**${repo.full_name}**\n` +
                (repo.description ? `${repo.description}\n` : "") +
                `Language: ${repo.language || "Not specified"} | Stars: ${repo.stargazers_count.toLocaleString()} | Forks: ${repo.forks_count.toLocaleString()}\n` +
                `Updated: ${new Date(repo.updated_at).toLocaleDateString()} | ${repo.html_url}\n`,
            )
            .join("\n");
        }
        return {
          content: [{ type: "text", text: summary }],
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
          details: {},
        };
      }
    },
  });
}
