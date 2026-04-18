import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { createBookmarkPromptComponent } from "./bookmark-prompt";
import { TestTerminal, createMockTheme } from "./test-utils";

function createMockPi(overrides?: Partial<ExtensionAPI>): ExtensionAPI {
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
      stdout: "",
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
    ...overrides,
  } as unknown as ExtensionAPI;
}

function createMockTui() {
  const terminal = new TestTerminal(120, 30);
  return {
    terminal,
    requestRender: vi.fn(),
  };
}

describe("bookmark-prompt", () => {
  describe("loading state", () => {
    it("renders the loading state while bookmarks are being fetched", async () => {
      let resolveLoad: () => void;
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });

      const mockPi = createMockPi({
        exec: vi.fn().mockReturnValue(loadPromise),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();

      // Resolve the load so we don't hang
      resolveLoad!();
    });
  });

  describe("error state", () => {
    it("renders an error when jj bookmark list fails", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "bookmark 'list' is not a jj command",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      // Wait for async error to settle
      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders a generic error message when stderr is empty", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("empty state", () => {
    it("renders empty state when no bookmarks exist", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("bookmark list rendering", () => {
    it("renders a single bookmark", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders multiple bookmarks with consistent padding", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout:
            "main\nfeature-login\nfix-bug-42\ndocs/readme\nrelease/v1.0\nhotfix/critical\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("deduplicates bookmarks", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\nmain\nfeature-a\nfeature-b\nmain\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("filters bookmarks by search query and shows unmatched as create option", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\nfeature-login\nfix-auth\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Simulate typing "feat" — should match feature-login and show "new feat" as create option
      component.handleInput("f");
      component.handleInput("e");
      component.handleInput("a");
      component.handleInput("t");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("shows all bookmarks when query is empty", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\ngamma\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Type and delete to ensure query is empty
      component.handleInput("a");
      component.handleInput("\x7f"); // backspace

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("shows create-only option when query matches no bookmarks", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\nfeature-a\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Type something that matches nothing
      component.handleInput("xyz-nonexistent");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("shows bookmark count indicator when there are many bookmarks", async () => {
      const bookmarks = Array.from(
        { length: 8 },
        (_, i) => `bookmark-${String(i).padStart(3, "0")}`,
      ).join("\n");

      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: bookmarks,
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("navigation and selection", () => {
    it("moves selection down on arrow-down key", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\ngamma\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Press down arrow twice to select gamma
      component.handleInput("\x1b[B");
      component.handleInput("\x1b[B");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("moves selection up on arrow-up key", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\ngamma\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Select gamma first (down twice), then up once to beta
      component.handleInput("\x1b[B");
      component.handleInput("\x1b[B");
      component.handleInput("\x1b[A");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("clamps selection to max when pressing down at end", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Press down beyond the end
      component.handleInput("\x1b[B");
      component.handleInput("\x1b[B");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("calls done with selected bookmark on enter", async () => {
      const doneFn = vi.fn();
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\ngamma\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        doneFn,
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Select beta (down once), then enter
      component.handleInput("\x1b[B");
      component.handleInput("\r");

      expect(doneFn).toHaveBeenCalledWith("beta");
    });

    it("calls done with null on escape", async () => {
      const doneFn = vi.fn();
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        doneFn,
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      component.handleInput("\x1b"); // Escape

      expect(doneFn).toHaveBeenCalledWith(null);
    });

    it("calls done with null when enter pressed with no candidates", async () => {
      const doneFn = vi.fn();
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        doneFn,
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      component.handleInput("\r"); // Enter with no candidates

      expect(doneFn).toHaveBeenCalledWith(null);
    });
  });

  describe("text input behavior", () => {
    it("resets selection to first item when typing changes query", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\ngamma\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Navigate to last item
      component.handleInput("\x1b[B");
      component.handleInput("\x1b[B");

      const resultBefore = component.render(120);

      // Type a new query — should reset selection to first match
      component.handleInput("g");

      const resultAfter = component.render(120);

      // The focused item should be different (gamma is now at index 0)
      expect(resultBefore).not.toEqual(resultAfter);
    });

    it("handles backspace in the input", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\ngamma\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Type "bet" then backspace to "be"
      component.handleInput("b");
      component.handleInput("e");
      component.handleInput("t");
      component.handleInput("\x7f");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("handles typed new bookmark name for creation", async () => {
      // When query doesn't match any existing bookmark, the last item is "new <query>"
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\nfeature-a\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Type a name that doesn't exist
      component.handleInput("new-feature");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("different terminal widths", () => {
    it("renders at narrow width", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\nfeature-a\nfix-bug\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      tui.terminal.width = 60;
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(60);
      expect(result).toMatchSnapshot();
    });

    it("renders at wide width", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\nfeature-a\nfix-bug\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      tui.terminal.width = 160;
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(160);
      expect(result).toMatchSnapshot();
    });
  });

  describe("rendering output stability", () => {
    it("produces identical output on repeated renders with same state", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "main\nfeature-a\nfix-bug\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      const result1 = component.render(120);
      const result2 = component.render(120);

      expect(result1).toEqual(result2);
    });

    it("produces identical output after navigation with same selection", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 0,
          stdout: "alpha\nbeta\ngamma\n",
          stderr: "",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent(
        mockPi,
        tui,
        theme,
        () => {},
        "/home/user/project",
      );

      await new Promise((r) => setTimeout(r, 50));

      // Navigate to middle item
      component.handleInput("\x1b[B");

      const result1 = component.render(120);
      const result2 = component.render(120);

      expect(result1).toEqual(result2);
    });
  });
});
