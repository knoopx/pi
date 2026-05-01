import { describe, it, expect } from "vitest";
import type { ToolResultEvent } from "@mariozechner/pi-coding-agent";
import { buildReminder } from "./formatter";
import { buildQuery } from "./query";
import { scoreAndRank } from "./rag";
import type { IndexedChunk } from "./cache";
import type { SkillReminderConfig } from "./settings";

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

const MOCK_CONFIG: SkillReminderConfig = {
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
    it("then the query should include the full invocation", () => {
      const event = makeEvent({
        toolName: "bash",
        input: { command: "npm run build" },
      });
      const query = buildQuery(event);
      expect(query).toContain('Tool "bash" execution failed');
      expect(query).toContain('Invocation: {"command":"npm run build"}');
    });
  });

  describe("given an event with a path in input", () => {
    it("then the query should include the full invocation", () => {
      const event = makeEvent({
        toolName: "read",
        input: { path: "/home/user/file.ts" },
      });
      expect(buildQuery(event)).toContain(
        'Invocation: {"path":"/home/user/file.ts"}',
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
  describe("given ranked hits with multiple skills", () => {
    it("then it should format each skill and its chunks", () => {
      const hits = [
        {
          skill: "vitest",
          chunks: [
            {
              file: "SKILL.md",
              section: "Setup",
              score: 0.85,
              text: "# Setup",
            },
            {
              file: "references/mocking-modules.md",
              section: "vi.mock",
              score: 0.72,
              text: "## Mocking Modules\n\nUse vi.mock to mock dependencies.",
            },
          ],
        },
        {
          skill: "jujutsu",
          chunks: [
            {
              file: "SKILL.md",
              section: "Conflicts",
              score: 0.65,
              text: "# Conflict Resolution",
            },
          ],
        },
      ];

      const reminder = buildReminder(hits);
      expect(reminder).toContain("`vitest`");
      expect(reminder).toContain("SKILL.md");
      expect(reminder).toContain("Setup");
      expect(reminder).toContain("0.850");
      expect(reminder).toContain("`jujutsu`");
      expect(reminder).toContain("Conflicts");
      expect(reminder).toContain("0.650");
    });
  });

  describe("given no hits", () => {
    it("then it should return an empty string", () => {
      const reminder = buildReminder([]);
      expect(reminder).toBe("");
    });
  });

  describe("given hits with decimal scores", () => {
    it("then it should format scores to three decimal places", () => {
      const hits = [
        {
          skill: "nix",
          chunks: [
            {
              file: "SKILL.md",
              section: "Run",
              score: 0.123456,
              text: "# Run",
            },
          ],
        },
      ];
      expect(buildReminder(hits)).toContain("0.123");
    });
  });
});

describe("scoreAndRank", () => {
  const makeIndex = (
    skill: string,
    sections: string[],
    embedding: number[],
  ): IndexedChunk[] =>
    sections.map((section) => ({
      skill,
      file: `${skill}/SKILL.md`,
      section,
      text: `# ${section}`,
      embedding,
    }));

  describe("given index entries that score above threshold", () => {
    it("then it should return ranked hits grouped by skill", () => {
      const identical = [1, 0, 0];
      const index: IndexedChunk[] = [
        ...makeIndex("vitest", ["Setup", "Mocking"], identical),
        ...makeIndex("jujutsu", ["Conflicts"], identical),
      ];

      const hits = scoreAndRank(index, identical, MOCK_CONFIG);
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].chunks[0].score).toBeCloseTo(1);
    });
  });

  describe("given index entries that all score below threshold", () => {
    it("then it should return an empty array", () => {
      const orthogonal = [0, 1, 0];
      const index = makeIndex("nix", ["Run"], [1, 0, 0]);

      const hits = scoreAndRank(index, orthogonal, MOCK_CONFIG);
      expect(hits).toEqual([]);
    });
  });

  describe("given more skills than maxSkills", () => {
    it("then it should return only the top scored skills", () => {
      const identical = [1, 0];
      const index: IndexedChunk[] = [
        ...makeIndex("a", ["x"], identical),
        ...makeIndex("b", ["y"], identical),
        ...makeIndex("c", ["z"], identical),
      ];

      const config: SkillReminderConfig = {
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
});
