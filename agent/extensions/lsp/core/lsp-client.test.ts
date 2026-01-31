/**
 * LSP Core LSP Client - BDD Unit Tests
 *
 * Tests the LSP client wrapper functions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MessageConnection } from "vscode-jsonrpc";

import {
  uriToPath,
  didOpen,
  didChange,
  didClose,
  didSave,
  diagnostics,
  hover,
  signatureHelp,
  definition,
  references,
  documentSymbols,
  rename,
  codeAction,
  shutdown,
} from "./lsp-client";

describe("LSP Client - URI to Path Conversion", () => {
  describe("given a file:// URI", () => {
    describe("when converting to path", () => {
      it("then returns the file path", () => {
        const uri = "file:///home/user/project/file.ts";
        const result = uriToPath(uri);
        expect(result).toBe("/home/user/project/file.ts");
      });
    });
  });

  describe("given a non-file URI", () => {
    describe("when converting to path", () => {
      it("then returns the URI as-is", () => {
        const uri = "https://example.com/file.ts";
        const result = uriToPath(uri);
        expect(result).toBe("https://example.com/file.ts");
      });
    });
  });

  describe("given an empty URI", () => {
    describe("when converting to path", () => {
      it("then returns empty string", () => {
        const uri = "";
        const result = uriToPath(uri);
        expect(result).toBe("");
      });
    });
  });
});

describe("LSP Client - Notification Functions", () => {
  let mockConnection: MessageConnection;

  beforeEach(() => {
    mockConnection = {
      sendNotification: (vi.fn() as any).mockResolvedValue(undefined),
      sendRequest: vi.fn(),
    } as unknown as MessageConnection;
  });

  describe("given didOpen notification", () => {
    describe("when sending notification", () => {
      it("then sends correct parameters", async () => {
        const filePath = "/path/to/file.ts";
        const languageId = "typescript";
        const content = "console.log('test');";

        await didOpen(mockConnection, filePath, languageId, content);

        expect(mockConnection.sendNotification).toHaveBeenCalledWith(
          "textDocument/didOpen",
          {
            textDocument: {
              uri: `file://${filePath}`,
              languageId,
              version: 1,
            },
            content,
          },
        );
      });
    });
  });

  describe("given didChange notification", () => {
    describe("when sending full content change", () => {
      it("then sends correct parameters", async () => {
        const filePath = "/path/to/file.ts";
        const version = 2;
        const content = "updated content";

        await didChange(mockConnection, filePath, version, content);

        expect(mockConnection.sendNotification).toHaveBeenCalledWith(
          "textDocument/didChange",
          {
            textDocument: {
              uri: `file://${filePath}`,
              version,
            },
            contentChanges: [{ text: content }],
          },
        );
      });
    });

    describe("when sending partial range change", () => {
      it("then sends correct parameters", async () => {
        const filePath = "/path/to/file.ts";
        const version = 2;
        const content = "updated content";
        const range = {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        };
        const text = "new";

        await didChange(
          mockConnection,
          filePath,
          version,
          content,
          range,
          text,
        );

        expect(mockConnection.sendNotification).toHaveBeenCalledWith(
          "textDocument/didChange",
          {
            textDocument: {
              uri: `file://${filePath}`,
              version,
            },
            contentChanges: [{ range, text }],
          },
        );
      });
    });
  });

  describe("given didClose notification", () => {
    describe("when sending notification", () => {
      it("then sends correct parameters", async () => {
        const filePath = "/path/to/file.ts";

        await didClose(mockConnection, filePath);

        expect(mockConnection.sendNotification).toHaveBeenCalledWith(
          "textDocument/didClose",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
          },
        );
      });
    });
  });

  describe("given didSave notification", () => {
    describe("when sending notification", () => {
      it("then sends correct parameters", async () => {
        const filePath = "/path/to/file.ts";

        await didSave(mockConnection, filePath);

        expect(mockConnection.sendNotification).toHaveBeenCalledWith(
          "textDocument/didSave",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
          },
        );
      });
    });
  });
});

describe("LSP Client - Request Functions", () => {
  let mockConnection: MessageConnection;

  beforeEach(() => {
    mockConnection = {
      sendNotification: vi.fn(),
      sendRequest: vi.fn(),
    } as unknown as MessageConnection;
  });

  describe("given diagnostics request", () => {
    describe("when sending request successfully", () => {
      it("then returns diagnostics array", async () => {
        const filePath = "/path/to/file.ts";
        const mockDiagnostics = [{ message: "error" }];
        (mockConnection.sendRequest as any).mockResolvedValue(mockDiagnostics);

        const result = await diagnostics(mockConnection, filePath);

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/diagnostic",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
          },
        );
        expect(result).toEqual(mockDiagnostics);
      });
    });

    describe("when request fails", () => {
      it("then returns empty array", async () => {
        const filePath = "/path/to/file.ts";
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await diagnostics(mockConnection, filePath);

        expect(result).toEqual([]);
      });
    });
  });

  describe("given hover request", () => {
    describe("when sending request successfully", () => {
      it("then returns hover result", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        const mockHover = { contents: "hover text" };
        (mockConnection.sendRequest as any).mockResolvedValue(mockHover);

        const result = await hover(mockConnection, filePath, line, character);

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/hover",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
            position: { line, character },
          },
        );
        expect(result).toEqual(mockHover);
      });
    });

    describe("when request fails", () => {
      it("then returns null", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await hover(mockConnection, filePath, line, character);

        expect(result).toBeNull();
      });
    });
  });

  describe("given signatureHelp request", () => {
    describe("when sending request successfully", () => {
      it("then returns signature help result", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        const mockSignature = { signatures: [] };
        (mockConnection.sendRequest as any).mockResolvedValue(mockSignature);

        const result = await signatureHelp(
          mockConnection,
          filePath,
          line,
          character,
        );

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/signatureHelp",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
            position: { line, character },
          },
        );
        expect(result).toEqual(mockSignature);
      });
    });

    describe("when request fails", () => {
      it("then returns null", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await signatureHelp(
          mockConnection,
          filePath,
          line,
          character,
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("given definition request", () => {
    describe("when sending request successfully", () => {
      it("then returns definition result", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        const mockDefinition = [{ uri: "file://def.ts", range: {} }];
        (mockConnection.sendRequest as any).mockResolvedValue(mockDefinition);

        const result = await definition(
          mockConnection,
          filePath,
          line,
          character,
        );

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/definition",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
            position: { line, character },
          },
        );
        expect(result).toEqual(mockDefinition);
      });
    });

    describe("when request fails", () => {
      it("then returns null", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await definition(
          mockConnection,
          filePath,
          line,
          character,
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("given references request", () => {
    describe("when sending request successfully", () => {
      it("then returns references result", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        const includeDeclaration = true;
        const mockReferences = [{ uri: "file://ref.ts", range: {} }];
        (mockConnection.sendRequest as any).mockResolvedValue(mockReferences);

        const result = await references(
          mockConnection,
          filePath,
          line,
          character,
          includeDeclaration,
        );

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/references",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
            position: { line, character },
            context: {
              includeDeclaration,
            },
          },
        );
        expect(result).toEqual(mockReferences);
      });
    });

    describe("when request fails", () => {
      it("then returns null", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await references(
          mockConnection,
          filePath,
          line,
          character,
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("given documentSymbols request", () => {
    describe("when sending request successfully", () => {
      it("then returns symbols result", async () => {
        const filePath = "/path/to/file.ts";
        const mockSymbols = [{ name: "MyClass", kind: 5 }];
        (mockConnection.sendRequest as any).mockResolvedValue(mockSymbols);

        const result = await documentSymbols(mockConnection, filePath);

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/documentSymbol",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
          },
        );
        expect(result).toEqual(mockSymbols);
      });
    });

    describe("when request fails", () => {
      it("then returns null", async () => {
        const filePath = "/path/to/file.ts";
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await documentSymbols(mockConnection, filePath);

        expect(result).toBeNull();
      });
    });
  });

  describe("given rename request", () => {
    describe("when sending request successfully", () => {
      it("then returns rename result", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        const newName = "newFunction";
        const mockRename = { changes: {} };
        (mockConnection.sendRequest as any).mockResolvedValue(mockRename);

        const result = await rename(
          mockConnection,
          filePath,
          line,
          character,
          newName,
        );

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/rename",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
            position: { line, character },
            newName,
          },
        );
        expect(result).toEqual(mockRename);
      });
    });

    describe("when request fails", () => {
      it("then returns null", async () => {
        const filePath = "/path/to/file.ts";
        const line = 5;
        const character = 10;
        const newName = "newFunction";
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await rename(
          mockConnection,
          filePath,
          line,
          character,
          newName,
        );

        expect(result).toBeNull();
      });
    });
  });

  describe("given codeAction request", () => {
    describe("when sending request successfully", () => {
      it("then returns code actions result", async () => {
        const filePath = "/path/to/file.ts";
        const startLine = 5;
        const startCharacter = 10;
        const endLine = 5;
        const endCharacter = 20;
        const mockActions = [{ title: "Fix error" }];
        (mockConnection.sendRequest as any).mockResolvedValue(mockActions);

        const result = await codeAction(
          mockConnection,
          filePath,
          startLine,
          startCharacter,
          endLine,
          endCharacter,
        );

        expect(mockConnection.sendRequest).toHaveBeenCalledWith(
          "textDocument/codeAction",
          {
            textDocument: {
              uri: `file://${filePath}`,
            },
            range: {
              start: { line: startLine, character: startCharacter },
              end: { line: endLine, character: endCharacter },
            },
            context: {
              diagnostics: [],
            },
          },
        );
        expect(result).toEqual(mockActions);
      });
    });

    describe("when request fails", () => {
      it("then returns null", async () => {
        const filePath = "/path/to/file.ts";
        const startLine = 5;
        const startCharacter = 10;
        const endLine = 5;
        const endCharacter = 20;
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        const result = await codeAction(
          mockConnection,
          filePath,
          startLine,
          startCharacter,
          endLine,
          endCharacter,
        );

        expect(result).toBeNull();
      });
    });
  });
});

describe("LSP Client - Shutdown", () => {
  let mockConnection: MessageConnection;

  beforeEach(() => {
    mockConnection = {
      sendNotification: (vi.fn() as any).mockResolvedValue(undefined),
      sendRequest: (vi.fn() as any).mockResolvedValue(undefined),
    } as unknown as MessageConnection;
  });

  describe("given shutdown request", () => {
    describe("when shutting down successfully", () => {
      it("then sends shutdown and exit", async () => {
        await shutdown(mockConnection);

        expect(mockConnection.sendRequest).toHaveBeenCalledWith("shutdown", {});
        expect(mockConnection.sendNotification).toHaveBeenCalledWith(
          "exit",
          {},
        );
      });
    });

    describe("when shutdown fails", () => {
      it("then does not throw", async () => {
        (mockConnection.sendRequest as any).mockRejectedValue(
          new Error("failed"),
        );

        await expect(shutdown(mockConnection)).resolves.toBeUndefined();
      });
    });
  });
});
