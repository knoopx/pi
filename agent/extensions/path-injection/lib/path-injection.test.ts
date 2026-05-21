import { describe, it, expect } from "vitest";
import {
  detectGlobs,
  extractFileFilter,
  formatGlobResult,
  formatTreeBlocks,
  runTree,
} from "./path-injection";

describe("detectGlobs", () => {
  it("returns empty array for text with no paths", async () => {
    expect(
      await detectGlobs("Please help me fix this bug in the code", "/tmp"),
    ).toEqual([]);
  });

  it("returns empty array for empty text", async () => {
    expect(await detectGlobs("", "/tmp")).toEqual([]);
  });

  it("returns empty array for whitespace-only text", async () => {
    expect(await detectGlobs("   \t\n  ", "/tmp")).toEqual([]);
  });

  it("ignores plain directory paths without glob characters", async () => {
    const globs = await detectGlobs("Look at /usr/bin please", "/tmp");
    expect(globs).toEqual([]);
  });

  it("ignores plain relative paths without glob characters", async () => {
    const globs = await detectGlobs(
      "Check agent/extensions/self-correction",
      "/home/knoopx/Projects/knoopx/pi",
    );
    expect(globs).toEqual([]);
  });

  it("ignores plain file paths without glob characters", async () => {
    const globs = await detectGlobs("Edit /etc/hostname please", "/tmp");
    expect(globs).toEqual([]);
  });

  it("ignores non-existent glob patterns", async () => {
    const globs = await detectGlobs(
      "Look at /this/does/not/match/*.xyz",
      "/tmp",
    );
    expect(globs).toEqual([]);
  });

  it("detects absolute glob pattern with existing matches", async () => {
    const globs = await detectGlobs("Check /usr/bin/*", "/tmp");
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("/usr/bin/*");
  });

  it("detects multiple glob patterns", async () => {
    const globs = await detectGlobs(
      "Check /usr/bin/* and /usr/share/*",
      "/tmp",
    );
    expect(globs).toHaveLength(2);
  });

  it("deduplicates the same glob referenced multiple times", async () => {
    const globs = await detectGlobs(
      "Look at /usr/bin/* and also /usr/bin/* again",
      "/tmp",
    );
    expect(globs.filter((g) => g.pattern === "/usr/bin/*")).toHaveLength(1);
  });

  it("handles glob patterns embedded in sentences", async () => {
    const globs = await detectGlobs(
      "I need you to review the structure of /usr/bin/* and tell me what's inside.",
      "/tmp",
    );
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("/usr/bin/*");
  });

  it("handles glob patterns at the start of text", async () => {
    const globs = await detectGlobs("/usr/bin/* is what I want to see", "/tmp");
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("/usr/bin/*");
  });

  it("handles glob patterns on separate lines", async () => {
    const globs = await detectGlobs(
      "First check /usr/bin/*\nThen look at /usr/share/*",
      "/tmp",
    );
    expect(globs).toHaveLength(2);
  });

  it("detects relative glob patterns", async () => {
    const globs = await detectGlobs(
      "Check agent/extensions/*",
      "/home/knoopx/Projects/knoopx/pi",
    );
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("agent/extensions/*");
    expect(globs[0].directories.length).toBeGreaterThan(0);
  });

  it("detects glob patterns with **", async () => {
    const globs = await detectGlobs(
      "Check agent/**/index.ts",
      "/home/knoopx/Projects/knoopx/pi",
    );
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("agent/**/index.ts");
  });

  it("detects glob patterns with question mark", async () => {
    const globs = await detectGlobs("Check /usr/bin/?*", "/tmp");
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("/usr/bin/?*");
  });

  it("detects glob patterns with character class", async () => {
    const globs = await detectGlobs("Check /usr/bin/[a-z]*", "/tmp");
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("/usr/bin/[a-z]*");
  });

  it("detects glob patterns inside quotes", async () => {
    const globs = await detectGlobs('Path is "/usr/bin/*" here', "/tmp");
    expect(globs).toHaveLength(1);
    expect(globs[0].pattern).toBe("/usr/bin/*");
  });

  it("detects glob patterns after punctuation", async () => {
    const globs = await detectGlobs("See: /usr/bin/* for details", "/tmp");
    expect(globs).toHaveLength(1);
  });

  it("detects glob patterns after commas", async () => {
    const globs = await detectGlobs(
      "Check /usr/bin/*, then /usr/share/*",
      "/tmp",
    );
    expect(globs).toHaveLength(2);
  });

  it("resolves relative glob patterns against cwd", async () => {
    const globs = await detectGlobs(
      "Check agent/extensions/*",
      "/home/knoopx/Projects/knoopx/pi",
    );
    expect(globs).toHaveLength(1);
    // Should have matched directories under agent/extensions/
    const allDirs = globs[0].directories;
    expect(allDirs.length + globs[0].files.length).toBeGreaterThan(0);
  });

  it("separates directories and files in results", async () => {
    const globs = await detectGlobs("Check /usr/*", "/tmp");
    expect(globs).toHaveLength(1);
    const result = globs[0];
    // /usr/* should match both dirs and files
    expect(result.directories.length + result.files.length).toBeGreaterThan(0);
  });
});

describe("runTree", () => {
  it("returns tree output for a valid directory", async () => {
    const result = await runTree("/usr/bin");
    expect(result).not.toBeNull();
    expect(result!).not.toBe("");
    // First line should be tree content, not the directory path header
    expect(result!.split("\n")[0]).toMatch(/^[├└]/);
  });

  it("returns null for a non-existent directory", async () => {
    const result = await runTree("/does/not/exist");
    expect(result).toBeNull();
  });

  it("returns null for a file path", async () => {
    const result = await runTree("/etc/hostname");
    expect(result).toBeNull();
  });

  it("trims whitespace from output", async () => {
    const result = await runTree("/usr/bin");
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });
});

describe("formatTreeBlocks", () => {
  it("returns empty string when no results", () => {
    expect(formatTreeBlocks([])).toBe("");
  });

  it("outputs tree with path label", () => {
    const results = [
      {
        path: "/home/user/project/src",
        output: "src/\n├── index.ts\n└── utils.ts",
      },
    ];
    expect(formatTreeBlocks(results)).toBe(
      "/home/user/project/src:\nsrc/\n├── index.ts\n└── utils.ts",
    );
  });

  it("joins multiple trees with double newline", () => {
    const results = [
      {
        path: "/home/user/project/a",
        output: "a/\n└── file.txt",
      },
      {
        path: "/home/user/project/b",
        output: "b/\n└── other.txt",
      },
    ];
    expect(formatTreeBlocks(results)).toBe(
      "/home/user/project/a:\na/\n└── file.txt\n\n/home/user/project/b:\nb/\n└── other.txt",
    );
  });

  it("handles output with special characters", () => {
    const results = [
      {
        path: "/path/with spaces",
        output: "dir/\n├── file (1).txt",
      },
    ];
    expect(formatTreeBlocks(results)).toBe(
      "/path/with spaces:\ndir/\n├── file (1).txt",
    );
  });
});

describe("formatGlobResult", () => {
  it("returns formatted output with glob pattern and trees", () => {
    const results = [
      {
        pattern: "/home/user/project/**/*.ts",
        directories: ["/home/user/project/src"],
        files: [],
        trees: [
          {
            path: "/home/user/project/src",
            output: "src/\n├── index.ts\n└── utils.ts",
          },
        ],
      },
    ];
    expect(formatGlobResult(results)).toBe(
      "Glob: /home/user/project/**/*.ts\n/home/user/project/src:\nsrc/\n├── index.ts\n└── utils.ts",
    );
  });

  it("returns formatted output with files", () => {
    const results = [
      {
        pattern: "/home/user/project/**/*.test.ts",
        directories: [],
        files: ["/home/user/project/a.test.ts", "/home/user/project/b.test.ts"],
        trees: [],
      },
    ];
    expect(formatGlobResult(results)).toBe(
      "Glob: /home/user/project/**/*.test.ts\n/home/user/project/a.test.ts\n/home/user/project/b.test.ts",
    );
  });

  it("returns formatted output with both trees and files", () => {
    const results = [
      {
        pattern: "/home/user/project/**/*",
        directories: ["/home/user/project/src"],
        files: ["/home/user/project/README.md"],
        trees: [
          {
            path: "/home/user/project/src",
            output: "src/\n├── index.ts\n└── utils.ts",
          },
        ],
      },
    ];
    expect(formatGlobResult(results)).toBe(
      "Glob: /home/user/project/**/*\n/home/user/project/src:\nsrc/\n├── index.ts\n└── utils.ts\n/home/user/project/README.md",
    );
  });

  it("joins multiple glob results with double newline", () => {
    const results = [
      {
        pattern: "/home/user/project/**/*.ts",
        directories: [],
        files: ["/home/user/project/a.ts"],
        trees: [],
      },
      {
        pattern: "/home/user/project/**/*.js",
        directories: [],
        files: ["/home/user/project/b.js"],
        trees: [],
      },
    ];
    expect(formatGlobResult(results)).toBe(
      "Glob: /home/user/project/**/*.ts\n/home/user/project/a.ts\n\nGlob: /home/user/project/**/*.js\n/home/user/project/b.js",
    );
  });
});

describe("extractFileFilter", () => {
  it("extracts file filter from glob with **", () => {
    expect(extractFileFilter("agent/extensions/**/*.ts")).toBe("*.ts");
  });

  it("extracts file filter from absolute path with **", () => {
    expect(extractFileFilter("/home/user/project/**/*.js")).toBe("*.js");
  });

  it("returns null for pattern without **", () => {
    expect(extractFileFilter("agent/extensions/*")).toBeNull();
  });

  it("extracts basename from path after **", () => {
    expect(extractFileFilter("src/**/test/*.spec.ts")).toBe("*.spec.ts");
  });

  it("handles multiple ** segments", () => {
    expect(extractFileFilter("a/**/b/**/c/*.ts")).toBe("*.ts");
  });

  it("extracts filter without leading wildcard", () => {
    expect(extractFileFilter("src/**/*.test.ts")).toBe("*.test.ts");
  });
});
