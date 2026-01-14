import { describe, it, expect, beforeEach, vi } from "vitest";
import setupGitHubExtension from "./index";

describe("GitHub Extension", () => {
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

  describe("github-repository-info tool", () => {
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
        stars: 42,
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
      expect(result.content[0].text).toBe(
        JSON.stringify(mockRepoData, null, 2),
      );
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

      expect(result.isError).toBe(true);
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

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Error fetching repository info: Network connection failed",
      );
    });
  });

  describe("github-user-info tool", () => {
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
        public_repos: 10,
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
      expect(result.content[0].text).toBe(
        JSON.stringify(mockUserData, null, 2),
      );
      expect(result.details.data).toEqual(mockUserData);
    });
  });

  describe("github-repository-issues tool", () => {
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
        { id: 1, title: "Issue 1", state: "open" },
        { id: 2, title: "Issue 2", state: "open" },
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
        "https://api.github.com/repos/owner/repo/issues?state=open&per_page=30",
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockIssues, null, 2));
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

  describe("github-raw-file tool", () => {
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
  });

  describe("search-github-repositories tool", () => {
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
          { name: "repo1", full_name: "owner/repo1" },
          { name: "repo2", full_name: "owner/repo2" },
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
        "https://api.github.com/search/repositories?q=language%3Ajavascript&sort=stars&order=desc&per_page=30",
      );
      expect(result.content[0].text).toBe(
        JSON.stringify(mockSearchResult, null, 2),
      );
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
