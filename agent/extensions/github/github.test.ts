import { describe, it, expect, beforeEach, vi } from "vitest";
import setupGitHubExtension from "./index";

describe("Scenario: GitHub Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
    };
    setupGitHubExtension(mockPi);
  });

  it("should register github-repository-info tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "github-repository-info",
        label: "GitHub Repository Info",
      }),
    );
  });

  it("should register github-user-info tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "github-user-info",
        label: "GitHub User Info",
      }),
    );
  });

  it("should register github-repository-issues tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "github-repository-issues",
        label: "GitHub Repository Issues",
      }),
    );
  });

  it("should register github-raw-file tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "github-raw-file",
        label: "GitHub Raw File",
      }),
    );
  });

  it("should register search-github-repositories tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "search-github-repositories",
        label: "Search GitHub Repositories",
      }),
    );
  });

  describe("Given github-repository-info tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "github-repository-info",
      )[0];
    });

    it("should fetch repository info successfully", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockRepoData = {
        name: "test-repo",
        full_name: "owner/test-repo",
        description: "A test repository",
        owner: { login: "owner" },
        language: "JavaScript",
        stargazers_count: 42,
        forks_count: 10,
        open_issues_count: 5,
        license: { name: "MIT" },
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-12-01T00:00:00Z",
        html_url: "https://github.com/owner/test-repo",
        homepage: "https://example.com",
        topics: ["javascript", "web"],
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockRepoData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "test-repo",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/test-repo",
      );
      expect(result.content[0].text).toContain("**test-repo** by owner");
      expect(result.content[0].text).toContain(
        "Description: A test repository",
      );
      expect(result.content[0].text).toContain("Language: JavaScript");
      expect(result.content[0].text).toContain("Stars: 42");
      expect(result.details.data).toEqual(mockRepoData);
    });

    it("should handle API errors", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        owner: "nonexistent",
        repo: "missing-repo",
      });

      expect(result.content[0].text).toContain(
        "GitHub API error: 404 Not Found",
      );
    });

    it("should handle network errors", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      const result = await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "repo",
      });

      expect(result.content[0].text).toContain(
        "Error fetching repository info: Network connection failed",
      );
    });
  });

  describe("Given github-user-info tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "github-user-info",
      )[0];
    });

    it("should fetch user info successfully", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockUserData = {
        login: "testuser",
        name: "Test User",
        bio: "A test user",
        location: "Earth",
        company: "Test Corp",
        followers: 100,
        following: 50,
        public_repos: 10,
        public_gists: 5,
        created_at: "2020-01-01T00:00:00Z",
        html_url: "https://github.com/testuser",
        blog: "https://blog.example.com",
        twitter_username: "testuser",
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockUserData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        username: "testuser",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/users/testuser",
      );
      expect(result.content[0].text).toContain("**Test User** (testuser)");
      expect(result.content[0].text).toContain("Bio: A test user");
      expect(result.content[0].text).toContain("Location: Earth");
      expect(result.content[0].text).toContain("Company: Test Corp");
      expect(result.content[0].text).toContain("Followers: 100");
      expect(result.details.data).toEqual(mockUserData);
    });
  });

  describe("Given github-repository-issues tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "github-repository-issues",
      )[0];
    });

    it("should fetch issues with default parameters", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockIssues = [
        {
          number: 1,
          title: "Issue 1",
          state: "open",
          user: { login: "user1" },
          created_at: "2023-01-01T00:00:00Z",
          labels: [{ name: "bug" }],
          html_url: "https://github.com/owner/repo/issues/1",
        },
        {
          number: 2,
          title: "Issue 2",
          state: "open",
          user: { login: "user2" },
          created_at: "2023-01-02T00:00:00Z",
          labels: [],
          html_url: "https://github.com/owner/repo/issues/2",
        },
      ];

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockIssues),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "repo",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/issues?state=open&per_page=10",
      );
      expect(result.content[0].text).toContain("Found 2 open issues:");
      expect(result.content[0].text).toContain("#1: Issue 1 (open)");
      expect(result.content[0].text).toContain("By user1");
      expect(result.details.count).toBe(2);
    });

    it("should fetch issues with custom parameters", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockIssues = [{ id: 1, title: "Closed Issue", state: "closed" }];

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockIssues),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "repo",
        state: "closed",
        per_page: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/issues?state=closed&per_page=10",
      );
      expect(result.details.count).toBe(1);
    });
  });

  describe("Given github-raw-file tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "github-raw-file",
      )[0];
    });

    it("should fetch raw file content", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const fileContent = "console.log('Hello, World!');";

      const mockResponse = {
        ok: true,
        text: () => Promise.resolve(fileContent),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "repo",
        path: "src/main.js",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/owner/repo/HEAD/src/main.js",
      );
      expect(result.content[0].text).toBe(fileContent);
      expect(result.details.contentLength).toBe(fileContent.length);
    });

    it("should use custom ref", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: true,
        text: () => Promise.resolve("content"),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "repo",
        path: "README.md",
        ref: "v1.0.0",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/owner/repo/v1.0.0/README.md",
      );
    });

    it("should handle 404 errors with helpful message", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        owner: "nonexistent",
        repo: "missing-repo",
        path: "file.txt",
      });

      expect(result.content[0].text).toContain(
        "GitHub raw file error: 404 Not Found. The requested file, repository, or branch/tag/commit could not be found",
      );
      expect(result.details.url).toBe(
        "https://raw.githubusercontent.com/nonexistent/missing-repo/HEAD/file.txt",
      );
    });

    it("should handle network errors", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      const result = await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "repo",
        path: "file.txt",
      });

      expect(result.content[0].text).toContain(
        "Error fetching raw file: Network connection failed",
      );
      expect(result.details.url).toBe(
        "https://raw.githubusercontent.com/owner/repo/HEAD/file.txt",
      );
    });

    it("should truncate large files", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const largeContent = "x".repeat(150 * 1024); // 150KB

      const mockResponse = {
        ok: true,
        text: () => Promise.resolve(largeContent),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        owner: "owner",
        repo: "repo",
        path: "large-file.txt",
      });

      expect(result.content[0].text).toContain("[File truncated - ");
      expect(result.details.contentLength).toBe(150 * 1024);
      expect(result.details.wasTruncated).toBe(true);
    });
  });

  describe("Given search-github-repositories tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "search-github-repositories",
      )[0];
    });

    it("should search repositories with default parameters", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockSearchResult = {
        total_count: 1234,
        items: [
          {
            full_name: "owner/repo1",
            description: "First repo",
            language: "JavaScript",
            stargazers_count: 100,
            forks_count: 20,
            updated_at: "2023-12-01T00:00:00Z",
            html_url: "https://github.com/owner/repo1",
          },
          {
            full_name: "owner/repo2",
            description: "Second repo",
            language: "Python",
            stargazers_count: 50,
            forks_count: 10,
            updated_at: "2023-11-01T00:00:00Z",
            html_url: "https://github.com/owner/repo2",
          },
        ],
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockSearchResult),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await registeredTool.execute("tool1", {
        query: "language:javascript",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/search/repositories?q=language%3Ajavascript&sort=stars&order=desc&per_page=10",
      );
      expect(result.content[0].text).toContain(
        "Found 1234 repositories (showing 2):",
      );
      expect(result.content[0].text).toContain("**owner/repo1**");
      expect(result.content[0].text).toContain("First repo");
      expect(result.details.totalCount).toBe(1234);
    });

    it("should search repositories with custom parameters", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockSearchResult = {
        total_count: 56,
        items: [{ name: "repo1" }],
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockSearchResult),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await registeredTool.execute("tool1", {
        query: "stars:>1000",
        sort: "forks",
        order: "asc",
        per_page: 5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/search/repositories?q=stars%3A%3E1000&sort=forks&order=asc&per_page=5",
      );
    });
  });
});
