import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  linearGraphQL,
  isIssueActive,
  fetchLinearTeams,
  createLinearIssue,
  updateLinearIssue,
  fetchLinearIssues,
} from "./linear";

describe("isIssueActive", () => {
  describe("given completed state", () => {
    describe("when checking if active", () => {
      it("then returns false", () => {
        expect(isIssueActive("completed")).toBe(false);
      });
    });
  });

  describe("given canceled state", () => {
    describe("when checking if active", () => {
      it("then returns false", () => {
        expect(isIssueActive("canceled")).toBe(false);
      });
    });
  });

  describe("given active states", () => {
    const activeStates = ["backlog", "unstarted", "started", "in_progress"];

    activeStates.forEach((state) => {
      describe(`when state is "${state}"`, () => {
        it("then returns true", () => {
          expect(isIssueActive(state)).toBe(true);
        });
      });
    });
  });
});

describe("linearGraphQL", () => {
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("given successful API response", () => {
    describe("when making request", () => {
      it("then returns parsed data", async () => {
        const mockData = { viewer: { id: "user-123" } };
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockData }),
        } as Response);

        const result = await linearGraphQL<typeof mockData>(mockApiKey, {
          query: "query { viewer { id } }",
        });

        expect(result).toEqual(mockData);
      });

      it("then sends correct headers", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        } as Response);

        await linearGraphQL(mockApiKey, { query: "query {}" });

        expect(fetch).toHaveBeenCalledWith(
          "https://api.linear.app/graphql",
          expect.objectContaining({
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: mockApiKey,
            },
          }),
        );
      });
    });
  });

  describe("given HTTP error response", () => {
    describe("when status is not ok", () => {
      it("then throws error with status", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          status: 401,
        } as Response);

        await expect(
          linearGraphQL(mockApiKey, { query: "query {}" }),
        ).rejects.toThrow("Linear API request failed with status 401");
      });
    });
  });

  describe("given GraphQL errors in response", () => {
    describe("when errors array is present", () => {
      it("then throws error with first message", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            errors: [{ message: "Invalid query" }],
          }),
        } as Response);

        await expect(
          linearGraphQL(mockApiKey, { query: "query {}" }),
        ).rejects.toThrow("Invalid query");
      });
    });
  });

  describe("given empty data in response", () => {
    describe("when data is null", () => {
      it("then throws error", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: null }),
        } as Response);

        await expect(
          linearGraphQL(mockApiKey, { query: "query {}" }),
        ).rejects.toThrow("Linear API returned no data");
      });
    });
  });
});

describe("fetchLinearTeams", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("given successful response", () => {
    describe("when fetching teams", () => {
      it("then returns array of teams", async () => {
        const mockTeams = [
          { id: "1", key: "ENG", name: "Engineering" },
          { id: "2", key: "DES", name: "Design" },
        ];

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { teams: { nodes: mockTeams } } }),
        } as Response);

        const result = await fetchLinearTeams("api-key");
        expect(result).toEqual(mockTeams);
      });
    });
  });
});

describe("createLinearIssue", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("given successful creation", () => {
    describe("when creating issue", () => {
      it("then returns identifier and url", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              issueCreate: {
                success: true,
                issue: {
                  id: "issue-1",
                  identifier: "ENG-123",
                  url: "https://linear.app/team/issue/ENG-123",
                },
              },
            },
          }),
        } as Response);

        const result = await createLinearIssue("api-key", "team-1", "New task");

        expect(result.identifier).toBe("ENG-123");
        expect(result.url).toBe("https://linear.app/team/issue/ENG-123");
      });
    });
  });

  describe("given failed creation", () => {
    describe("when success is false", () => {
      it("then throws error", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              issueCreate: {
                success: false,
                issue: null,
              },
            },
          }),
        } as Response);

        await expect(
          createLinearIssue("api-key", "team-1", "New task"),
        ).rejects.toThrow("Failed to create issue");
      });
    });
  });
});

describe("updateLinearIssue", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("given successful update", () => {
    describe("when updating issue", () => {
      it("then completes without error", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              issueUpdate: {
                success: true,
                issue: { id: "issue-1", title: "Updated title" },
              },
            },
          }),
        } as Response);

        await expect(
          updateLinearIssue("api-key", "issue-1", "Updated title"),
        ).resolves.toBeUndefined();
      });
    });
  });

  describe("given failed update", () => {
    describe("when success is false", () => {
      it("then throws error", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              issueUpdate: {
                success: false,
                issue: null,
              },
            },
          }),
        } as Response);

        await expect(
          updateLinearIssue("api-key", "issue-1", "Updated"),
        ).rejects.toThrow("Failed to update issue");
      });
    });
  });
});

describe("fetchLinearIssues", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("given successful response", () => {
    describe("when fetching issues", () => {
      it("then returns viewer ID and issues", async () => {
        const mockIssues = [
          {
            id: "issue-1",
            identifier: "ENG-1",
            title: "Task 1",
            description: null,
            priority: 2,
            url: "https://linear.app/ENG-1",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            creator: { id: "user-1", name: "Alice" },
            assignee: null,
            state: {
              id: "state-1",
              name: "Todo",
              type: "unstarted",
              color: "#ccc",
            },
            team: { key: "ENG" },
          },
        ];

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              viewer: { id: "current-user" },
              issues: { nodes: mockIssues },
            },
          }),
        } as Response);

        const result = await fetchLinearIssues("api-key");

        expect(result.viewerId).toBe("current-user");
        expect(result.issues).toEqual(mockIssues);
      });
    });
  });
});
