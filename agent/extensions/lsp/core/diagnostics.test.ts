/**
 * LSP Core Diagnostics - BDD Unit Tests
 *
 * Tests diagnostic formatting, filtering, and URI handling
 */

import { describe, it, expect } from "vitest";
import {
  formatDiagnostic,
  filterDiagnosticsBySeverity,
  uriToPath,
  findSymbolPosition,
  resolvePosition,
} from "../core/diagnostics";

describe("formatDiagnostic", () => {
  describe("given a diagnostic with error severity", () => {
    describe("when formatting the diagnostic", () => {
      it("then shows ERROR prefix", () => {
        const diagnostic = {
          severity: 1,
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 20 },
          },
          message: "Test error message",
        };

        const result = formatDiagnostic(diagnostic as unknown);

        expect(result).toContain("ERROR");
        expect(result).toContain("Test error message");
      });

      it("then shows 1-indexed line and column", () => {
        const diagnostic = {
          severity: 1,
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 20 },
          },
          message: "Test error",
        };

        const result = formatDiagnostic(diagnostic as unknown);

        expect(result).toContain("[6:11]"); // 1-indexed
      });
    });
  });

  describe("given a diagnostic with warning severity", () => {
    describe("when formatting the diagnostic", () => {
      it("then shows WARN prefix", () => {
        const diagnostic = {
          severity: 2,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
          message: "Test warning",
        };

        const result = formatDiagnostic(diagnostic as unknown);

        expect(result).toContain("WARN");
        expect(result).toContain("Test warning");
      });
    });
  });

  describe("given a diagnostic with info severity", () => {
    describe("when formatting the diagnostic", () => {
      it("then shows INFO prefix", () => {
        const diagnostic = {
          severity: 3,
          range: {
            start: { line: 10, character: 5 },
            end: { line: 10, character: 15 },
          },
          message: "Test info",
        };

        const result = formatDiagnostic(diagnostic as unknown);

        expect(result).toContain("INFO");
      });
    });
  });

  describe("given a diagnostic with hint severity", () => {
    describe("when formatting the diagnostic", () => {
      it("then shows HINT prefix", () => {
        const diagnostic = {
          severity: 4,
          range: {
            start: { line: 2, character: 0 },
            end: { line: 2, character: 10 },
          },
          message: "Test hint",
        };

        const result = formatDiagnostic(diagnostic as unknown);

        expect(result).toContain("HINT");
      });
    });
  });

  describe("given a diagnostic with undefined severity", () => {
    describe("when formatting the diagnostic", () => {
      it("then uses default severity (warning)", () => {
        const diagnostic = {
          severity: undefined,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
          message: "Test diagnostic",
        };

        const result = formatDiagnostic(diagnostic as unknown);

        expect(result).toContain("WARN");
      });
    });
  });

  describe("given a diagnostic with invalid severity", () => {
    describe("when formatting the diagnostic", () => {
      it("then uses undefined for out-of-bounds severity", () => {
        const diagnostic = {
          severity: 999,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
          message: "Test diagnostic",
        };

        const result = formatDiagnostic(diagnostic as unknown);

        expect(result).toBe("undefined [1:1] Test diagnostic");
      });
    });
  });
});

describe("filterDiagnosticsBySeverity", () => {
  const diagnostics = [
    {
      severity: 1,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 5 },
      },
      message: "Error",
    },
    {
      severity: 2,
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 5 },
      },
      message: "Warning",
    },
    {
      severity: 3,
      range: {
        start: { line: 2, character: 0 },
        end: { line: 2, character: 5 },
      },
      message: "Info",
    },
    {
      severity: 4,
      range: {
        start: { line: 3, character: 0 },
        end: { line: 3, character: 5 },
      },
      message: "Hint",
    },
  ] as unknown[];

  describe("given filter 'all'", () => {
    describe("when filtering diagnostics", () => {
      it("then returns all diagnostics", () => {
        const result = filterDiagnosticsBySeverity(diagnostics, "all");

        expect(result).toHaveLength(4);
      });
    });
  });

  describe("given filter 'error'", () => {
    describe("when filtering diagnostics", () => {
      it("then returns only error diagnostics", () => {
        const result = filterDiagnosticsBySeverity(diagnostics, "error");

        expect(result).toHaveLength(1);
        expect(result[0].message).toBe("Error");
      });
    });
  });

  describe("given filter 'warning'", () => {
    describe("when filtering diagnostics", () => {
      it("then returns errors and warnings", () => {
        const result = filterDiagnosticsBySeverity(diagnostics, "warning");

        expect(result).toHaveLength(2);
        expect(result[0].message).toBe("Error");
        expect(result[1].message).toBe("Warning");
      });
    });
  });

  describe("given filter 'info'", () => {
    describe("when filtering diagnostics", () => {
      it("then returns errors, warnings, and info", () => {
        const result = filterDiagnosticsBySeverity(diagnostics, "info");

        expect(result).toHaveLength(3);
      });
    });
  });

  describe("given filter 'hint'", () => {
    describe("when filtering diagnostics", () => {
      it("then returns all diagnostics", () => {
        const result = filterDiagnosticsBySeverity(diagnostics, "hint");

        expect(result).toHaveLength(4);
      });
    });
  });

  describe("given empty diagnostic array", () => {
    describe("when filtering", () => {
      it("then returns empty array", () => {
        const result = filterDiagnosticsBySeverity([], "error");

        expect(result).toHaveLength(0);
      });
    });
  });
});

describe("uriToPath", () => {
  describe("given a file:// URI", () => {
    describe("when converting to path", () => {
      it("then removes file:// prefix", () => {
        const uri = "file:///home/user/project/file.ts";
        const result = uriToPath(uri);

        expect(result).toBe("/home/user/project/file.ts");
      });

      it("then handles URIs without leading slash", () => {
        const uri = "file:///home/user/project/file.ts";
        const result = uriToPath(uri);

        expect(result).toBe("/home/user/project/file.ts");
      });
    });
  });

  describe("given a regular file path", () => {
    describe("when converting", () => {
      it("then returns the path unchanged", () => {
        const path = "/home/user/project/file.ts";
        const result = uriToPath(path);

        expect(result).toBe(path);
      });

      it("then handles relative paths", () => {
        const path = "./file.ts";
        const result = uriToPath(path);

        expect(result).toBe(path);
      });
    });
  });

  describe("given a malformed URI", () => {
    describe("when converting", () => {
      it("then returns the URI as-is", () => {
        const uri = "http://example.com/file.ts";
        const result = uriToPath(uri);

        expect(result).toBe(uri);
      });
    });
  });
});

describe("findSymbolPosition", () => {
  const symbols: unknown[] = [
    {
      name: "MyClass",
      selectionRange: { start: { line: 5, character: 6 } },
      children: [
        {
          name: "myMethod",
          selectionRange: { start: { line: 10, character: 2 } },
        },
        {
          name: "myProperty",
          range: { start: { line: 15, character: 2 } },
        },
      ],
    },
    {
      name: "helperFunction",
      selectionRange: { start: { line: 20, character: 0 } },
    },
  ];

  describe("given a symbol name", () => {
    describe("when exact match exists", () => {
      it("then returns exact position", () => {
        const result = findSymbolPosition(symbols, "MyClass");

        expect(result).toEqual({ line: 5, character: 6 });
      });
    });

    describe("when partial match exists", () => {
      it("then returns position of partial match", () => {
        const result = findSymbolPosition(symbols, "helper");

        expect(result).toEqual({ line: 20, character: 0 });
      });
    });

    describe("when no match exists", () => {
      it("then returns null", () => {
        const result = findSymbolPosition(symbols, "nonExistent");

        expect(result).toBeNull();
      });
    });
  });

  describe("given nested symbols", () => {
    describe("when searching for nested symbol", () => {
      it("then finds nested symbol", () => {
        const result = findSymbolPosition(symbols, "myMethod");

        expect(result).toEqual({ line: 10, character: 2 });
      });
    });
  });

  describe("given case sensitivity", () => {
    describe("when searching with lowercase", () => {
      it("then finds symbol (case-insensitive)", () => {
        const result = findSymbolPosition(symbols, "myclass");

        expect(result).toEqual({ line: 5, character: 6 });
      });
    });
  });

  describe("given symbols with only range", () => {
    describe("when searching for symbol with range", () => {
      it("then returns range position", () => {
        const symbolsWithRange = [
          {
            name: "Function",
            range: {
              start: { line: 3, character: 0 },
              end: { line: 3, character: 10 },
            },
          },
        ];
        const result = findSymbolPosition(symbolsWithRange, "Function");

        expect(result).toEqual({ line: 3, character: 0 });
      });
    });
  });
});

describe("resolvePosition", () => {
  describe("given a file and symbol query", () => {
    describe("when symbol exists in file", () => {
      it("then returns the position", async () => {
        const symbols: unknown[] = [
          {
            name: "MyFunction",
            selectionRange: { start: { line: 10, character: 5 } },
          },
        ];

        // Mock the manager's getDocumentSymbols
        const mockManager = {
          getDocumentSymbols: async () => symbols,
        };

        const result = await resolvePosition(
          mockManager as unknown,
          "file.ts",
          "MyFunction",
        );

        expect(result).toEqual({ line: 10, character: 5 });
      });
    });

    describe("when symbol does not exist", () => {
      it("then returns null", async () => {
        const symbols: unknown[] = [];
        const mockManager = {
          getDocumentSymbols: async () => symbols,
        };

        const result = await resolvePosition(
          mockManager as unknown,
          "file.ts",
          "NonExistent",
        );

        expect(result).toBeNull();
      });
    });
  });
});
