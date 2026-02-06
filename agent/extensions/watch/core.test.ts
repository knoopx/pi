/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "./core";

// ============================================
// Mock Types and Functions
// ============================================

// Mock fs module for file system operations
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("node:path", () => ({
  relative: vi.fn(),
}));

// ============================================
// Line Pattern Tests
// ============================================
describe("line parsing patterns", () => {
  describe("given PI anywhere in line", () => {
    const testCases = [
      {
        input: "// do this !pi",
        expectedTrigger: true,
        scenario: "with !pi in comment",
      },
      {
        input: "# implement this PI",
        expectedTrigger: false,
        scenario: "with PI in comment",
      },
      {
        input: "-- make this faster !pi",
        expectedTrigger: true,
        scenario: "with -- marker",
      },
      {
        input: "// !pi do this",
        expectedTrigger: true,
        scenario: "!pi at start of comment",
      },
      {
        input: "# PI implement this",
        expectedTrigger: false,
        scenario: "PI at start of comment",
      },
      {
        input: "  // comment !pi",
        expectedTrigger: true,
        scenario: "with whitespace",
      },
      {
        input: "// comment pi",
        expectedTrigger: false,
        scenario: "lowercase pi",
      },
      {
        input: "// comment PI",
        expectedTrigger: false,
        scenario: "uppercase PI",
      },
      {
        input: "code // !pi action",
        expectedTrigger: true,
        scenario: "code before comment",
      },
      {
        input: "console.log('hello !pi');",
        expectedTrigger: true,
        scenario: "!pi in string",
      },
      {
        input: "const x = pi;",
        expectedTrigger: false,
        scenario: "pi as variable name",
      },
      {
        input: "if (!pi) return;",
        expectedTrigger: true,
        scenario: "!pi in code condition",
      },
      {
        input: "function !pi() {}",
        expectedTrigger: true,
        scenario: "!pi as function name",
      },
      {
        input: "let !pi = true;",
        expectedTrigger: true,
        scenario: "!pi as variable",
      },
    ];

    testCases.forEach(({ input, expectedTrigger, scenario }) => {
      it(`then should detect ${scenario}`, () => {
        const result = core.lineHasTrigger(input);
        expect(result).toBe(expectedTrigger);
      });
    });
  });

  describe("given lines without pi", () => {
    const testCases = [
      { input: "regular code", expected: null },
      { input: "  code with spaces", expected: null },
      { input: "code // comment", expected: null },
      { input: "code # comment", expected: null },
      { input: "code -- comment", expected: null },
      { input: "// not a pi comment", expected: false },
      { input: "# not a pi comment", expected: false },
      { input: "console.log('no pi here');", expected: false },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`then should return null for "${input}"`, () => {
        const result = core.lineHasTrigger(input);
        expect(result).toBe(expected);
      });
    });
  });
});

// ============================================
// Line Grouping Tests
// ============================================
describe("grouping consecutive lines", () => {
  describe("given multiple consecutive PI lines", () => {
    const testCases = [
      {
        input: [
          "// step 1 !pi",
          "// step 2 !pi",
          "// step 3 !pi",
          "code here",
          "// step 4 !pi",
        ],
        expectedCount: 2,
        expectedTriggers: 2,
        scenario: "all consecutive with triggers",
      },
      {
        input: [
          "// step 1 pi",
          "// step 2 pi",
          "// step 3 pi",
          "code here",
          "// step 4 pi",
        ],
        expectedCount: 0,
        expectedTriggers: 0,
        scenario: "all consecutive without triggers",
      },
      {
        input: [
          "console.log('!pi step 1');",
          "// step 2 pi",
          "let !pi = true;",
          "code",
          "function pi() {}",
          "// step 5 !pi",
        ],
        expectedCount: 3,
        expectedTriggers: 3,
        scenario: "mixed triggers in code and comments",
      },
    ];

    testCases.forEach(
      ({ input, expectedCount, expectedTriggers, scenario }) => {
        it(`then should group ${scenario}`, () => {
          const result = core.parsePIReferencesInFile(
            "/test/file.ts",
            input.join("\n"),
          );
          expect(result).toHaveLength(expectedCount);
          expect(
            result.reduce((sum, c) => sum + (c.hasTrigger ? 1 : 0), 0),
          ).toBe(expectedTriggers);
        });
      },
    );
  });

  describe("given non-pi lines between pi lines", () => {
    const testCases = [
      {
        input: [
          "// pi comment",
          "code here",
          "// another pi",
          "more code",
          "// final pi",
        ],
        expectedGroups: 0,
        expectedTriggers: 0,
        scenario: "with code in between",
      },
      {
        input: ["// !pi start", "// more !pi", "code", "// !pi end"],
        expectedGroups: 2,
        expectedTriggers: 2,
        scenario: "all with triggers separated by code",
      },
      {
        input: [
          "console.log('pi');",
          "let x = 1;",
          "const !pi = true;",
          "more code",
          "function pi() {}",
        ],
        expectedGroups: 1,
        expectedTriggers: 1,
        scenario: "pi in code separated by regular code",
      },
    ];

    testCases.forEach(
      ({ input, expectedGroups, expectedTriggers, scenario }) => {
        it(`then should create ${expectedGroups} groups for ${scenario}`, () => {
          const result = core.parsePIReferencesInFile(
            "/test/file.ts",
            input.join("\n"),
          );
          expect(result).toHaveLength(expectedGroups);
          expect(
            result.reduce((sum, c) => sum + (c.hasTrigger ? 1 : 0), 0),
          ).toBe(expectedTriggers);
        });
      },
    );
  });
});

// ============================================
// File Reading Tests
// ============================================
describe("reading and parsing files", () => {
  describe("given valid file with PI lines", () => {
    it("then should return parsed references with correct structure", () => {
      const content = [
        "// !pi fix this bug",
        "// another pi comment",
        "function test() {",
        "  // pi do this",
        "  return true",
        "}",
        "console.log('!pi debug this');",
        "const pi = 3.14;",
      ].join("\n");

      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const result = core.readFileAndParsePIReferences("/test/file.ts");
      expect(result).not.toBeNull();
      expect(result?.references).toHaveLength(2);
      expect(result?.references[0].hasTrigger).toBe(true);
      expect(result?.references[1].hasTrigger).toBe(true);
    });
  });

  describe("given file without PI lines", () => {
    it("then should return empty references array", () => {
      const content = [
        "// regular comment",
        "function test() {",
        "  return true",
        "}",
        "console.log('hello world');",
      ].join("\n");

      vi.mocked(fs.readFileSync).mockReturnValue(content);

      const result = core.readFileAndParsePIReferences("/test/file.ts");
      expect(result).not.toBeNull();
      expect(result?.references).toHaveLength(0);
    });
  });

  describe("given unreadable file", () => {
    it("then should return null", () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("File not found");
      });

      const result = core.readFileAndParsePIReferences("/test/file.ts");
      expect(result).toBeNull();
    });
  });

  describe("given empty file", () => {
    it("then should return empty references array", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("");

      const result = core.readFileAndParsePIReferences("/test/file.ts");
      expect(result).not.toBeNull();
      expect(result?.references).toHaveLength(0);
    });
  });
});

// ============================================
// Message Creation Tests
// ============================================
describe("creating messages from comments", () => {
  const testCases = [
    {
      comments: [
        {
          filePath: "/test/file.ts",
          lineNumber: 1,
          rawLines: ["// !pi fix this"],
          hasTrigger: true,
        },
      ],
      expectedContent:
        'The PI comments below can be found in the code files.\nThey contain your instructions.\nLine numbers are provided for reference.\nRules:\n- Only make changes to files and lines that have PI comments.\n- Do not modify unknown other files or areas of files.\n- Follow the instructions in the PI comments strictly.\n- Be sure to remove all PI comments from the code during or after the changes.\n- After changes are finished say just "Done" and nothing else.\n\ntest/file.ts:\n1: // !pi fix this',
    },
    {
      comments: [
        {
          filePath: "/test/file.ts",
          lineNumber: 1,
          rawLines: ["// pi step 1"],
          hasTrigger: false,
        },
        {
          filePath: "/test/file.ts",
          lineNumber: 3,
          rawLines: ["// pi step 2"],
          hasTrigger: false,
        },
      ],
      expectedContent:
        'The PI comments below can be found in the code files.\nThey contain your instructions.\nLine numbers are provided for reference.\nRules:\n- Only make changes to files and lines that have PI comments.\n- Do not modify unknown other files or areas of files.\n- Follow the instructions in the PI comments strictly.\n- Be sure to remove all PI comments from the code during or after the changes.\n- After changes are finished say just "Done" and nothing else.\n\ntest/file.ts:\n1: // pi step 1\n\ntest/file.ts:\n3: // pi step 2',
    },
  ];

  testCases.forEach(({ comments, expectedContent }, i) => {
    it(`then should create correct message for case ${i + 1}`, () => {
      vi.mocked(path.relative).mockReturnValue("test/file.ts");
      const result = core.createMessage(comments);
      expect(result).toBe(expectedContent);
    });
  });

  describe("given empty comments array", () => {
    it("then should return empty string", () => {
      const result = core.createMessage([]);
      expect(result).toBe("");
    });
  });
});

// ============================================
// Path Filtering Tests
// ============================================
describe("path filtering", () => {
  describe("given patterns", () => {
    const testCases = [
      { path: "/project/.git/config", shouldIgnore: true, pattern: ".git" },
      {
        path: "/project/node_modules/package.json",
        shouldIgnore: true,
        pattern: "node_modules",
      },
      { path: "/project/dist/bundle.js", shouldIgnore: true, pattern: "dist" },
      { path: "/project/.pi/config", shouldIgnore: true, pattern: ".pi" }, // Updated since .pi is no longer ignored
      {
        path: "/project/src/index.ts",
        shouldIgnore: false,
        pattern: "node_modules",
      },
      { path: "/project/README.md", shouldIgnore: false, pattern: "dist" },
    ];

    testCases.forEach(({ path, shouldIgnore, pattern }) => {
      it(`then should ${shouldIgnore ? "ignore" : "not ignore"} ${path}`, () => {
        const result = core.shouldIgnorePath(path, [new RegExp(pattern)]);
        expect(result).toBe(shouldIgnore);
      });
    });
  });

  describe("given multiple patterns", () => {
    it("then should return true if any pattern matches", () => {
      const result = core.shouldIgnorePath("/project/.git/config", [
        /\.git/,
        /node_modules/,
        /dist/,
      ]);
      expect(result).toBe(true);
    });

    it("then should return false if no patterns match", () => {
      const result = core.shouldIgnorePath("/project/src/index.ts", [
        /\.git/,
        /node_modules/,
        /dist/,
      ]);
      expect(result).toBe(false);
    });
  });

  describe("given empty patterns array", () => {
    it("then should return false for all paths", () => {
      const result = core.shouldIgnorePath("/project/src/index.ts", []);
      expect(result).toBe(false);
    });
  });
});

// ============================================
// Trigger Detection Tests
// ============================================
describe("trigger detection", () => {
  describe("given comments with triggers", () => {
    const testCases = [
      {
        references: [
          {
            filePath: "/test.ts",
            lineNumber: 1,
            rawLines: ["// !pi fix"],
            hasTrigger: true,
          },
        ],
        expected: true,
      },
      {
        references: [
          {
            filePath: "/test.ts",
            lineNumber: 1,
            rawLines: ["// !pi fix"],
            hasTrigger: true,
          },
          {
            filePath: "/test2.ts",
            lineNumber: 1,
            rawLines: ["// pi step"],
            hasTrigger: false,
          },
        ],
        expected: true,
      },
      {
        references: [
          {
            filePath: "/test.ts",
            lineNumber: 1,
            rawLines: ["// pi step"],
            hasTrigger: false,
          },
        ],
        expected: false,
      },
      { references: [], expected: false },
    ];

    testCases.forEach(({ references, expected }, i) => {
      it(`then should return ${expected} for case ${i + 1}`, () => {
        const result = core.hasTrigger(references);
        expect(result).toBe(expected);
      });
    });
  });
});

// ============================================
// Edge Cases and Error Handling
// ============================================
describe("edge cases and error handling", () => {
  describe("given null or undefined input", () => {
    it("then should handle null file path", () => {
      expect(() =>
        core.readFileAndParsePIReferences(null as any),
      ).not.toThrow();
    });

    it("then should handle undefined content", () => {
      const result = core.parsePIReferencesInFile(
        "/test/file.ts",
        undefined as any,
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("given very large files", () => {
    it("then should handle large files efficiently", () => {
      const largeContent = Array(1000).fill("// pi comment").join("\n");
      const result = core.parsePIReferencesInFile(
        "/test/file.ts",
        largeContent,
      );
      expect(result).toHaveLength(0); // No triggers, so empty
    });
  });
});
