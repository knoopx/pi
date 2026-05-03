import { describe, it, expect } from "vitest";
import type { ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { buildReminder } from "./reminder";
import { buildQuery } from "./query-builder";
import { scoreAndRank } from "./scorer";
import type { IndexedSection } from "../../shared/indexing/cache";
import type { Config } from "./config";

function makeEvent(
  overrides: Partial<ToolResultEvent> & { toolName?: string } = {},
): ToolResultEvent {
  return {
    type: "tool_result" as const,
    toolCallId: "test-call-id",
    toolName: "bash",
    isError: true,
    input: {},
    content: [],
    details: undefined,
    ...overrides,
  };
}

const MOCK_CONFIG: Config = {
  enabled: true,
  serverUrl: "http://localhost:11434/v1/embeddings",
  embeddingModel: "test-model",
  scoreThreshold: 0.35,
  maxSkills: 4,
  chunkMaxChars: 1000,
  promptScoreThreshold: 0.85,
};

describe("buildQuery", () => {
  describe("given a failed tool event with no extra context", () => {
    it("then it should return a basic failure message", () => {
      const event = makeEvent({ toolName: "bash" });
      expect(buildQuery(event)).toContain('Tool "bash" execution failed');
    });
  });

  describe("given an event with a command in input", () => {
    it("then the query should describe the command being run", () => {
      const event = makeEvent({
        toolName: "bash",
        input: { command: "npm run build" },
      });
      const query = buildQuery(event);
      expect(query).toContain("Running command: npm run build failed");
    });
  });

  describe("given an event with a path in input", () => {
    it("then the query should describe the file operation", () => {
      const event = makeEvent({
        toolName: "read",
        input: { path: "/home/user/file.ts" },
      });
      expect(buildQuery(event)).toContain(
        "Reading file: /home/user/file.ts failed",
      );
    });
  });

  describe("given an event with text content items", () => {
    it("then the query should include the text content", () => {
      const event = makeEvent({
        toolName: "bash",
        content: [{ type: "text", text: "error: command not found" }],
      });
      expect(buildQuery(event)).toContain("error: command not found");
    });
  });

  describe("given an event with mixed content types", () => {
    it("then it should only include text content items", () => {
      const event = makeEvent({
        toolName: "bash",
        content: [
          { type: "text", text: "stderr output" },
          { type: "image", data: "base64data", mimeType: "image/png" },
        ],
      });
      const query = buildQuery(event);
      expect(query).toContain("stderr output");
      expect(query).not.toContain("screenshot.png");
    });
  });

  describe("given an event with empty text content", () => {
    it("then it should filter out the empty text", () => {
      const event = makeEvent({
        toolName: "bash",
        content: [
          { type: "text", text: "" },
          { type: "text", text: "real" },
        ],
      });
      expect(buildQuery(event)).not.toContain("\n\n");
      expect(buildQuery(event)).toContain("real");
    });
  });
});

describe("buildReminder", () => {
  describe("given ranked hits", () => {
    it("then it should prepend a preamble and format as a compact table sorted by score", () => {
      const hits = [
        {
          score: 0.85,
          skill: "test",
          file: "SKILL.md",
          section: "Setup",
          text: "# Setup",
        },
        {
          score: 0.72,
          skill: "test",
          file: "SKILL.md",
          section: "Mocking",
          text: "## Mocking Modules\n\nUse vi.mock.",
        },
        {
          score: 0.65,
          skill: "test",
          file: "SKILL.md",
          section: "Conflicts",
          text: "# Conflict Resolution",
        },
      ];

      const reminder = buildReminder(hits);
      expect(reminder).toContain(
        "The following skill content may help resolve this error:",
      );
      expect(reminder).toContain("SKILL.md → Setup");
      expect(reminder).toContain("SKILL.md → Mocking");
      expect(reminder).toContain("SKILL.md → Conflicts");
      const setupIdx = reminder.indexOf("→ Setup");
      const mockingIdx = reminder.indexOf("→ Mocking");
      const conflictsIdx = reminder.indexOf("→ Conflicts");
      expect(setupIdx).toBeLessThan(mockingIdx);
      expect(mockingIdx).toBeLessThan(conflictsIdx);
    });
  });

  describe("given no hits", () => {
    it("then it should return an empty string", () => {
      const reminder = buildReminder([]);
      expect(reminder).toBe("");
    });
  });
});

describe("scoreAndRank", () => {
  const makeIndex = (
    sections: string[],
    embedding: number[],
  ): IndexedSection[] =>
    sections.map((section) => ({
      skill: "test",
      file: "SKILL.md",
      section,
      text: `# ${section}`,
      embedding,
    }));

  describe("given index entries that score above threshold", () => {
    it("then it should return ranked chunks sorted by score", () => {
      const identical = [1, 0, 0];
      const index: IndexedSection[] = [
        ...makeIndex(["Setup", "Mocking"], identical),
        ...makeIndex(["Conflicts"], identical),
      ];

      const hits = scoreAndRank(index, identical, MOCK_CONFIG);
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].score).toBeCloseTo(1);
    });
  });

  describe("given index entries that all score below threshold", () => {
    it("then it should return an empty array", () => {
      const orthogonal = [0, 1, 0];
      const index = makeIndex(["Run"], [1, 0, 0]);

      const hits = scoreAndRank(index, orthogonal, MOCK_CONFIG);
      expect(hits).toEqual([]);
    });
  });

  describe("given more chunks than maxSkills", () => {
    it("then it should return only the top scored chunks", () => {
      const identical = [1, 0];
      const index: IndexedSection[] = [
        {
          skill: "a",
          file: "SKILL.md",
          section: "x",
          text: "# x",
          embedding: [1, 0],
        },
        {
          skill: "b",
          file: "SKILL.md",
          section: "y",
          text: "# y",
          embedding: [1, 0],
        },
        {
          skill: "c",
          file: "SKILL.md",
          section: "z",
          text: "# z",
          embedding: [1, 0],
        },
      ];

      const config: Config = {
        ...MOCK_CONFIG,
        maxSkills: 2,
      };
      const hits = scoreAndRank(index, identical, config);
      expect(hits.length).toBeLessThanOrEqual(2);
    });
  });

  describe("given an empty index", () => {
    it("then it should return an empty array", () => {
      const hits = scoreAndRank([], [1, 2, 3], MOCK_CONFIG);
      expect(hits).toEqual([]);
    });
  });

  describe("given multiple chunks with the same file + section", () => {
    it("then it should keep only the highest-scoring chunk", () => {
      const identical = [1, 0, 0];
      const index: IndexedSection[] = [
        {
          skill: "test",
          file: "SKILL.md",
          section: "Setup",
          text: "# Setup\nIntro.",
          embedding: [1, 0, 0],
        },
        {
          skill: "test",
          file: "SKILL.md",
          section: "Setup",
          text: "# Setup\nMore detail.",
          embedding: [0.9, 0, 0],
        },
        {
          skill: "test",
          file: "SKILL.md",
          section: "Other",
          text: "# Other",
          embedding: identical,
        },
      ];

      const hits = scoreAndRank(index, identical, MOCK_CONFIG);
      expect(hits.length).toBe(2);
      expect(hits.find((h) => h.section === "Setup")!.score).toBeCloseTo(1);
      expect(hits.filter((h) => h.section === "Setup").length).toBe(1);
    });
  });
});
