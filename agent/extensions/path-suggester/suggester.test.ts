import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PathSuggesterConfig } from "./settings";
import * as embeddingsModule from "../../shared/embeddings/engine";

// Mock cosine to return deterministic values
vi.mock("../../shared/embeddings/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof embeddingsModule>();
  return {
    ...actual,
    cosine: vi.fn(actual.cosine),
  };
});

const cosineMock = vi.mocked(embeddingsModule.cosine);

function makeEntry(
  path: string,
  embedding: number[],
): import("./file-index").RawEntry {
  return { path, contentSnippet: "", symbolText: "", embedding };
}

function makeConfig(
  overrides?: Partial<PathSuggesterConfig>,
): PathSuggesterConfig {
  const defaults: PathSuggesterConfig = {
    enabled: true,
    serverUrl: "http://localhost:11434/v1/embeddings",
    embeddingModel: "unsloth/embeddinggemma-300m-GGUF",
    maxSuggestions: 5,
    scoreThreshold: 0.6,
    promptScoreThreshold: 0.6,
  };
  return { ...defaults, ...overrides };
}

describe("scoreAndRank", () => {
  describe("given an empty index", () => {
    it("then it should return an empty array", () => {
      import("./suggester").then(({ scoreAndRank }) => {
        const result = scoreAndRank([], [0.1, 0.2], makeConfig(), "/project");
        expect(result).toEqual([]);
      });
    });
  });

  describe("given entries with high similarity scores", () => {
    beforeEach(() => {
      cosineMock.mockReturnValue(0.95);
    });

    it("then it should return all entries above the threshold", () => {
      import("./suggester").then(({ scoreAndRank }) => {
        const index = [
          makeEntry("/project/src/a.ts", [1, 0]),
          makeEntry("/project/src/b.ts", [1, 0]),
        ];

        const result = scoreAndRank(index, [1, 0], makeConfig(), "/project");

        expect(result).toHaveLength(2);
        expect(result[0].relPath).toBe("src/a.ts");
        expect(result[1].relPath).toBe("src/b.ts");
      });
    });
  });

  describe("given entries with mixed scores", () => {
    beforeEach(() => {
      cosineMock.mockImplementation((_a, _b) => {
        const calls = cosineMock.mock.calls.length;
        return calls <= 1 ? 0.9 : 0.5;
      });
    });

    it("then it should filter out entries below the threshold", () => {
      import("./suggester").then(({ scoreAndRank }) => {
        const index = [
          makeEntry("/project/src/good.ts", [1, 0]),
          makeEntry("/project/src/bad.ts", [0, 1]),
        ];

        const result = scoreAndRank(index, [1, 0], makeConfig(), "/project");

        expect(result).toHaveLength(1);
        expect(result[0].relPath).toBe("src/good.ts");
      });
    });
  });

  describe("given a custom score threshold", () => {
    it("then it should respect the higher threshold", () => {
      cosineMock.mockReturnValue(0.75);

      import("./suggester").then(({ scoreAndRank }) => {
        const index = [makeEntry("/project/src/x.ts", [1, 0])];

        // Threshold of 0.8 excludes the 0.75 score
        const result = scoreAndRank(
          index,
          [1, 0],
          makeConfig({ scoreThreshold: 0.8 }),
          "/project",
        );
        expect(result).toEqual([]);

        // Reset mock for second assertion
        cosineMock.mockClear();
        cosineMock.mockReturnValue(0.75);

        // Threshold of 0.7 includes it
        const result2 = scoreAndRank(
          index,
          [1, 0],
          makeConfig({ scoreThreshold: 0.7 }),
          "/project",
        );
        expect(result2).toHaveLength(1);
      });
    });
  });

  describe("given more results than maxSuggestions", () => {
    beforeEach(() => {
      cosineMock.mockReturnValue(0.95);
    });

    it("then it should return only maxSuggestions entries", () => {
      import("./suggester").then(({ scoreAndRank }) => {
        const index = [
          makeEntry("/project/src/a.ts", [1, 0]),
          makeEntry("/project/src/b.ts", [1, 0]),
          makeEntry("/project/src/c.ts", [1, 0]),
          makeEntry("/project/src/d.ts", [1, 0]),
          makeEntry("/project/src/e.ts", [1, 0]),
        ];

        const result = scoreAndRank(
          index,
          [1, 0],
          makeConfig({ maxSuggestions: 3 }),
          "/project",
        );

        expect(result).toHaveLength(3);
      });
    });
  });

  describe("given entries with different scores", () => {
    beforeEach(() => {
      cosineMock.mockImplementation((_a, _b) => {
        const calls = cosineMock.mock.calls.length;
        return [0.9, 0.7, 0.95][calls - 1] ?? 0;
      });
    });

    it("then it should sort results by score descending", () => {
      import("./suggester").then(({ scoreAndRank }) => {
        const index = [
          makeEntry("/project/src/medium.ts", [0.5, 0]),
          makeEntry("/project/src/low.ts", [0, 1]),
          makeEntry("/project/src/high.ts", [1, 0]),
        ];

        const result = scoreAndRank(
          index,
          [1, 0],
          makeConfig({ maxSuggestions: 3 }),
          "/project",
        );

        expect(result[0].relPath).toBe("src/high.ts");
        expect(result[1].relPath).toBe("src/medium.ts");
        expect(result[2].relPath).toBe("src/low.ts");
      });
    });
  });

  describe("given absolute paths", () => {
    beforeEach(() => {
      cosineMock.mockReturnValue(0.95);
    });

    it("then relPath should be relative to projectDir", () => {
      import("./suggester").then(({ scoreAndRank }) => {
        const index = [
          makeEntry("/home/user/myproject/src/deep/nested/file.ts", [1, 0]),
        ];

        const result = scoreAndRank(
          index,
          [1, 0],
          makeConfig(),
          "/home/user/myproject",
        );

        expect(result[0].relPath).toBe("src/deep/nested/file.ts");
      });
    });
  });

  describe("given the same path for projectDir and entry", () => {
    beforeEach(() => {
      cosineMock.mockReturnValue(0.95);
    });

    it("then relPath should not contain the projectDir prefix", () => {
      import("./suggester").then(({ scoreAndRank }) => {
        const index = [makeEntry("/project/file.ts", [1, 0])];

        const result = scoreAndRank(index, [1, 0], makeConfig(), "/project");

        expect(result[0].relPath).toBe("file.ts");
      });
    });
  });
});
