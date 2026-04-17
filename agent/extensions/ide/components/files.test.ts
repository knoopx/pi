import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { createFilesComponent, type FileResult } from "./files";
import { TestTerminal, createMockTheme } from "./test-utils";

function createMockPi(): ExtensionAPI {
  return {
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn().mockReturnValue(null),
    registerMessageRenderer: vi.fn(),
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
    appendEntry: vi.fn(),
    setSessionName: vi.fn(),
    getSessionName: vi.fn(),
    setLabel: vi.fn(),
    exec: vi.fn().mockResolvedValue({
      code: 0,
      stdout:
        "agent/extensions/ide/components/files.ts\nagent/extensions/ide/components/list-picker.ts\nagent/extensions/nix/nix.test.ts\n",
      stderr: "",
    }),
    getActiveTools: vi.fn(),
    getAllTools: vi.fn(),
    setActiveTools: vi.fn(),
    setModel: vi.fn(),
    getThinkingLevel: vi.fn(),
    setThinkingLevel: vi.fn(),
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getCommands: vi.fn(),
    events: {},
  } as unknown as ExtensionAPI;
}

function createMockTui() {
  const terminal = new TestTerminal(120, 30);
  return {
    terminal,
    requestRender: vi.fn(),
  };
}

describe("files — list row rendering", () => {
  let mockPi: ExtensionAPI;
  let tui: ReturnType<typeof createMockTui>;
  let theme: Theme;

  beforeEach(() => {
    mockPi = createMockPi();
    tui = createMockTui();
    theme = createMockTheme();
  });

  describe("given a list of files", () => {
    it("renders file rows with consistent padding across different path lengths", async () => {
      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      // Wait for items to load
      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders rows with leading space before file icons", async () => {
      const mockPiWithFiles: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout:
            "a.ts\nagent/extensions/ide/components/list-picker.test.ts\nagent/extensions/nix/nix.test.ts\n",
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPiWithFiles,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders file rows with mixed extensions and consistent left alignment", async () => {
      const mockPiMixed: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: [
            "src/index.ts",
            "src/utils/helper.ts",
            "README.md",
            "package.json",
            "flake.nix",
            "__tests__/test.test.ts",
          ].join("\n"),
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPiMixed,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given a long file list", () => {
    it("renders scrollable rows with consistent padding for all visible items", async () => {
      const files = [
        "agent/extensions/ide/components/files.ts",
        "agent/extensions/ide/components/list-picker.ts",
        "agent/extensions/ide/components/split-panel/border.ts",
        "agent/extensions/nix/nix.test.ts",
        "agent/extensions/gh/index.ts",
        "agent/shared/tool-utils.ts",
        "agent/extensions/usage/usage.test.ts",
        "flake.nix",
        "package.json",
        "README.md",
        "src/main.rs",
        "src/lib.go",
        "__snapshots__/files.test.ts.snap",
        "__tests__/test.test.ts",
        ".gitignore",
      ].join("\n");

      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: files,
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("maintains consistent row padding when terminal height is smaller than file count", async () => {
      const files = Array.from(
        { length: 30 },
        (_, i) =>
          `agent/extensions/ide/components/file-${String(i).padStart(3, "0")}.ts`,
      ).join("\n");

      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: files,
          stderr: "",
        }),
      };

      const narrowTui = createMockTui();
      narrowTui.terminal.height = 15;
      narrowTui.terminal.width = 80;

      const component = createFilesComponent(
        mockPi,
        narrowTui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(80);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given files with different icon types", () => {
    it("renders rows consistently for TypeScript files", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "index.ts\napp.tsx\nconfig.mts\nutils.cts\n",
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders rows consistently for YAML/Nix files", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "flake.nix\ndocker-compose.yml\nconfig.yaml\n.env\n",
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders rows consistently for various file types in mixed list", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: [
            "src/main.ts",
            "flake.lock",
            "package.json",
            "Dockerfile",
            "Makefile",
            ".gitignore",
            "README.md",
            "Cargo.toml",
            "go.mod",
            "requirements.txt",
          ].join("\n"),
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given selected files", () => {
    it("renders selected rows with checkmark prefix and consistent padding", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "file-a.ts\nfile-b.ts\nfile-c.ts\n",
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Trigger selection by simulating selectedFiles state
      const filesView = component as any;
      filesView.selectedFiles.add("file-a.ts");
      filesView.selectedFiles.add("file-c.ts");
      filesView.invalidate();

      await new Promise((r) => setTimeout(r, 10));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders all selected rows with consistent left padding regardless of position", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: [
            "short.ts",
            "a-very-long-file-name-that-needs-truncation.ts",
            "medium.ts",
          ].join("\n"),
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const filesView = component as any;
      filesView.selectedFiles.add("short.ts");
      filesView.selectedFiles.add("medium.ts");
      filesView.invalidate();

      await new Promise((r) => setTimeout(r, 10));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given an empty file list", () => {
    it("renders the no items message with consistent padding", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "",
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given a file load error", () => {
    it("renders the error message with consistent padding", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "rg: command not found",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 100));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given a search query filter", () => {
    it("renders filtered results with consistent padding", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: [
            "agent.ts",
            "agent/index.ts",
            "config.yaml",
            "README.md",
            "agent/test.ts",
          ].join("\n"),
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "agent",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given different terminal widths", () => {
    it("renders with consistent padding at narrow width", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "a.ts\nlong-file-name-here.ts\nc.ts\n",
          stderr: "",
        }),
      };

      const narrowTui = createMockTui();
      narrowTui.terminal.width = 60;

      const component = createFilesComponent(
        mockPi,
        narrowTui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(60);
      expect(result).toMatchSnapshot();
    });

    it("renders with consistent padding at wide width", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "a.ts\nb.ts\nc.ts\n",
          stderr: "",
        }),
      };

      const wideTui = createMockTui();
      wideTui.terminal.width = 160;

      const component = createFilesComponent(
        mockPi,
        wideTui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(160);
      expect(result).toMatchSnapshot();
    });
  });

  describe("rendering output stability", () => {
    it("produces identical output on repeated renders with same state", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "file-a.ts\nfile-b.ts\nfile-c.ts\n",
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result1 = component.render(120);
      const result2 = component.render(120);

      expect(result1).toEqual(result2);
    });

    it("produces identical output when selected files set changes", async () => {
      const mockPi: ExtensionAPI = {
        ...createMockPi(),
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "a.ts\nb.ts\nc.ts\n",
          stderr: "",
        }),
      };

      const component = createFilesComponent(
        mockPi,
        tui,
        theme,
        {} as any,
        () => {},
        "",
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const filesView = component as any;
      filesView.selectedFiles.add("b.ts");
      filesView.invalidate();
      await new Promise((r) => setTimeout(r, 10));

      const result1 = component.render(120);
      const result2 = component.render(120);

      expect(result1).toEqual(result2);
    });
  });
});
