import { describe, it, expect, beforeEach, vi } from "vitest";
import setupSessionsExtension from "./index";

describe("Scenario: Sessions Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerCommand: vi.fn(),
    };
    setupSessionsExtension(mockPi);
  });

  it("should register sessions command", () => {
    expect(mockPi.registerCommand).toHaveBeenCalledWith("sessions", {
      description:
        "Browse previous sessions sorted by most recent and restore them",
      handler: expect.any(Function),
    });
  });

  describe("Given sessions command handler", () => {
    let handler: any;
    let mockCtx: any;

    beforeEach(() => {
      handler = mockPi.registerCommand.mock.calls[0][1].handler;
      mockCtx = {
        hasUI: true,
        ui: {
          notify: vi.fn(),
          select: vi.fn(),
          setEditorText: vi.fn(),
        },
      };
    });

    it("should show error if not in interactive mode", async () => {
      mockCtx.hasUI = false;

      await handler("", mockCtx);

      expect(mockCtx.ui.notify).toHaveBeenCalledWith(
        "sessions requires interactive mode",
        "error",
      );
    });

    describe("Given interactive mode enabled", () => {
      beforeEach(() => {
        mockCtx.hasUI = true;
      });

      it("should notify when no session files found", async () => {
        // Mock file system operations
        const mockReaddirSync = vi.fn().mockReturnValue([]);
        const mockStatSync = vi.fn();
        const mockReadFileSync = vi.fn();

        vi.mock("node:fs", () => ({
          readdirSync: mockReaddirSync,
          statSync: mockStatSync,
          readFileSync: mockReadFileSync,
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        await handler("", mockCtx);

        expect(mockCtx.ui.notify).toHaveBeenCalledWith(
          "No previous sessions found",
          "info",
        );
      });

      it("should handle file system errors gracefully", async () => {
        // Mock file system to throw error
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn(() => {
            throw new Error("Permission denied");
          }),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        await handler("", mockCtx);

        expect(mockCtx.ui.notify).toHaveBeenCalledWith(
          "No previous sessions found",
          "info",
        );
      });

      it("should show session selection dialog with parsed sessions", async () => {
        const mockSessionContent = JSON.stringify({
          type: "message",
          message: {
            role: "user",
            content: [{ type: "text", text: "Hello world command" }],
          },
        });

        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === "/home/user/.pi/agent/sessions") {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date("2024-01-20T10:00:00Z") })),
          readFileSync: vi.fn(() => mockSessionContent),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("0");

        await handler("", mockCtx);

        expect(mockCtx.ui.select).toHaveBeenCalledWith(
          "Select a session to restore:",
          expect.arrayContaining([
            expect.stringContaining("Hello world command"),
          ]),
        );
      });

      it("should restore selected session", async () => {
        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === "/home/user/.pi/agent/sessions") {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date("2024-01-20T10:00:00Z") })),
          readFileSync: vi.fn(() => "mock content"),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("0");

        await handler("", mockCtx);

        expect(mockCtx.ui.setEditorText).toHaveBeenCalledWith(
          `/resume /home/user/.pi/agent/sessions/session1.jsonl`,
        );
        expect(mockCtx.ui.notify).toHaveBeenCalledWith(
          "Selected session loaded. Press Enter to restore.",
          "info",
        );
      });

      it("should handle user cancelling session selection", async () => {
        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === "/home/user/.pi/agent/sessions") {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date("2024-01-20T10:00:00Z") })),
          readFileSync: vi.fn(() => "mock content"),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue(undefined); // User cancelled

        await handler("", mockCtx);

        expect(mockCtx.ui.setEditorText).not.toHaveBeenCalled();
        expect(mockCtx.ui.notify).not.toHaveBeenCalledWith(
          "Selected session loaded. Press Enter to restore.",
          "info",
        );
      });

      it("should handle invalid selection index", async () => {
        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === "/home/user/.pi/agent/sessions") {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date("2024-01-20T10:00:00Z") })),
          readFileSync: vi.fn(() => "mock content"),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("invalid");

        await handler("", mockCtx);

        expect(mockCtx.ui.notify).toHaveBeenCalledWith(
          "Invalid selection",
          "error",
        );
      });

      it("should handle out of bounds selection", async () => {
        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === "/home/user/.pi/agent/sessions") {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date("2024-01-20T10:00:00Z") })),
          readFileSync: vi.fn(() => "mock content"),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("5"); // Out of bounds

        await handler("", mockCtx);

        expect(mockCtx.ui.notify).toHaveBeenCalledWith(
          "Invalid selection",
          "error",
        );
      });

      it("should sort sessions by modification time (newest first)", async () => {
        const sessionsDir = "/home/user/.pi/agent/sessions";

        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === sessionsDir) {
              return [
                {
                  name: "old.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
                {
                  name: "new.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn((path) => {
            if (path.includes("new.jsonl")) {
              return { mtime: new Date("2024-01-20T12:00:00Z") };
            } else {
              return { mtime: new Date("2024-01-20T10:00:00Z") };
            }
          }),
          readFileSync: vi.fn(() =>
            JSON.stringify({
              type: "message",
              message: {
                role: "user",
                content: [{ type: "text", text: "test" }],
              },
            }),
          ),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("0");

        await handler("", mockCtx);

        // Should select the first option which should be the newest (new.jsonl)
        expect(mockCtx.ui.setEditorText).toHaveBeenCalledWith(
          `/resume ${sessionsDir}/new.jsonl`,
        );
      });

      it("should limit displayed sessions to 20 most recent", async () => {
        const sessionsDir = "/home/user/.pi/agent/sessions";
        const mockFiles = Array.from({ length: 25 }, (_, i) => ({
          name: `session${i}.jsonl`,
          isFile: () => true,
          isDirectory: () => false,
        }));

        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === sessionsDir) {
              return mockFiles;
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date() })),
          readFileSync: vi.fn(() =>
            JSON.stringify({
              type: "message",
              message: {
                role: "user",
                content: [{ type: "text", text: "test" }],
              },
            }),
          ),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("0");

        await handler("", mockCtx);

        const selectCall = mockCtx.ui.select.mock.calls[0];
        expect(selectCall[1]).toHaveLength(20); // Should limit to 20
      });

      it("should handle file read errors gracefully", async () => {
        const sessionsDir = "/home/user/.pi/agent/sessions";

        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === sessionsDir) {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date() })),
          readFileSync: vi.fn(() => {
            throw new Error("Permission denied");
          }),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("0");

        await handler("", mockCtx);

        // Should still work with "Error reading file" preview
        expect(mockCtx.ui.select).toHaveBeenCalledWith(
          "Select a session to restore:",
          expect.arrayContaining([
            expect.stringContaining("Error reading file"),
          ]),
        );
      });

      it("should handle malformed JSON in session files", async () => {
        const sessionsDir = "/home/user/.pi/agent/sessions";

        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === sessionsDir) {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date() })),
          readFileSync: vi.fn(() => "invalid json content\nmore content"),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("0");

        await handler("", mockCtx);

        // Should handle malformed JSON gracefully
        expect(mockCtx.ui.select).toHaveBeenCalledWith(
          "Select a session to restore:",
          expect.arrayContaining([expect.stringContaining("No preview")]),
        );
      });

      it("should recursively find session files in subdirectories", async () => {
        const sessionsDir = "/home/user/.pi/agent/sessions";
        const subDir = "/home/user/.pi/agent/sessions/subdir";

        // Mock file system operations
        vi.mock("node:fs", () => ({
          readdirSync: vi.fn((path) => {
            if (path === sessionsDir) {
              return [
                {
                  name: "session1.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
                {
                  name: "subdir",
                  isFile: () => false,
                  isDirectory: () => true,
                },
              ];
            } else if (path === subDir) {
              return [
                {
                  name: "session2.jsonl",
                  isFile: () => true,
                  isDirectory: () => false,
                },
              ];
            }
            return [];
          }),
          statSync: vi.fn(() => ({ mtime: new Date() })),
          readFileSync: vi.fn(() =>
            JSON.stringify({
              type: "message",
              message: {
                role: "user",
                content: [{ type: "text", text: "test" }],
              },
            }),
          ),
        }));

        vi.mock("node:path", () => ({
          join: vi.fn((...args) => args.join("/")),
        }));

        vi.mock("node:os", () => ({
          homedir: vi.fn(() => "/home/user"),
        }));

        mockCtx.ui.select.mockResolvedValue("0");

        await handler("", mockCtx);

        // Should find both files
        const selectCall = mockCtx.ui.select.mock.calls[0];
        expect(selectCall[1]).toHaveLength(2);
      });
    });
  });
});
