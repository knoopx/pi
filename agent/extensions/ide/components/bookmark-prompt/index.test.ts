import { describe, it, expect, vi } from "vitest";
import { createBookmarkPromptComponent } from "./index";
import type { TestTerminal } from "../../lib/test-utils";
import {
  createMockPi,
  createMockTui,
  createMockTheme,
} from "../../lib/test-utils";

const REPO = "/home/user/project";

async function createComponentFromExec(execReturn: {
  code: number;
  stdout: string;
  stderr: string;
}): Promise<ReturnType<typeof createBookmarkPromptComponent>> {
  const mockPi = createMockPi({
    exec: vi.fn().mockResolvedValue(execReturn),
  });
  const tui = createMockTui();
  const theme = createMockTheme();

  const component = createBookmarkPromptComponent({
    pi: mockPi,
    tui,
    theme,
    done: () => {},
    cwd: REPO,
  });

  await new Promise((r) => setTimeout(r, 50));
  return component;
}

async function createFixture(
  stdout: string,
  overrides?: Partial<Parameters<typeof createMockPi>[0]>,
  doneFn?: () => void,
) {
  const mockPi = createMockPi({
    exec: vi.fn().mockResolvedValue({ code: 0, stdout, stderr: "" }),
    ...overrides,
  });
  const tui = createMockTui();
  const theme = createMockTheme();

  const component = createBookmarkPromptComponent({
    pi: mockPi,
    tui,
    theme,
    done: doneFn ?? (() => {}),
    cwd: REPO,
  });

  await new Promise((r) => setTimeout(r, 50));
  return { component, tui };
}

describe("bookmark-prompt", () => {
  describe("loading state", () => {
    it("renders the loading state while bookmarks are being fetched", () => {
      const resolveLoadRef: { current: (() => void) | null } = {
        current: null,
      };
      const loadPromise = new Promise<void>((resolve) => {
        resolveLoadRef.current = resolve;
      });

      const mockPi = createMockPi({
        exec: vi.fn().mockReturnValue(loadPromise),
      });
      const tui = createMockTui();
      const theme = createMockTheme();

      const component = createBookmarkPromptComponent({
        pi: mockPi,
        tui,
        theme,
        done: () => {},
        cwd: "/home/user/project",
      });

      const result = component.render(120);
      expect(result).toMatchSnapshot();

      resolveLoadRef.current?.();
    });
  });

  describe("error state", () => {
    it("renders an error when jj bookmark list fails", async () => {
      const component = await createComponentFromExec({
        code: 1,
        stdout: "",
        stderr: "bookmark 'list' is not a jj command",
      });

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders a generic error message when stderr is empty", async () => {
      const component = await createComponentFromExec({
        code: 1,
        stdout: "",
        stderr: "",
      });

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("empty state", () => {
    it("renders empty state when no bookmarks exist", async () => {
      const { component } = await createFixture("");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("bookmark list rendering", () => {
    it("renders a single bookmark", async () => {
      const { component } = await createFixture("main\n");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders multiple bookmarks with consistent padding", async () => {
      const { component } = await createFixture(
        "main\nfeature-login\nfix-bug-42\ndocs/readme\nrelease/v1.0\nhotfix/critical\n",
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("deduplicates bookmarks", async () => {
      const { component } = await createFixture(
        "main\nmain\nfeature-a\nfeature-b\nmain\n",
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("filters bookmarks by search query and shows unmatched as create option", async () => {
      const { component } = await createFixture(
        "main\nfeature-login\nfix-auth\n",
      );

      // Simulate typing "feat" — should match feature-login and show "new feat" as create option
      component.handleInput?.("f");
      component.handleInput?.("e");
      component.handleInput?.("a");
      component.handleInput?.("t");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("shows all bookmarks when query is empty", async () => {
      const { component } = await createFixture("alpha\nbeta\ngamma\n");

      // Type and delete to ensure query is empty
      component.handleInput?.("a");
      component.handleInput?.("\x7f"); // backspace

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("shows create-only option when query matches no bookmarks", async () => {
      const { component } = await createFixture("main\nfeature-a\n");

      // Type something that matches nothing
      component.handleInput?.("xyz-nonexistent");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("shows bookmark count indicator when there are many bookmarks", async () => {
      const bookmarks = Array.from(
        { length: 8 },
        (_, i) => `bookmark-${String(i).padStart(3, "0")}`,
      ).join("\n");

      const { component } = await createFixture(bookmarks);

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("navigation and selection", () => {
    it("moves selection down on arrow-down key", async () => {
      const { component } = await createFixture("alpha\nbeta\ngamma\n");

      // Press down arrow twice to select gamma
      component.handleInput?.("\x1b[B");
      component.handleInput?.("\x1b[B");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("moves selection up on arrow-up key", async () => {
      const { component } = await createFixture("alpha\nbeta\ngamma\n");

      // Select gamma first (down twice), then up once to beta
      component.handleInput?.("\x1b[B");
      component.handleInput?.("\x1b[B");
      component.handleInput?.("\x1b[A");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("clamps selection to max when pressing down at end", async () => {
      const { component } = await createFixture("alpha\nbeta\n");

      // Press down beyond the end
      component.handleInput?.("\x1b[B");
      component.handleInput?.("\x1b[B");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("calls done with selected bookmark on enter", async () => {
      const doneFn = vi.fn();
      const { component } = await createFixture(
        "alpha\nbeta\ngamma\n",
        undefined,
        doneFn,
      );

      // Select beta (down once), then enter
      component.handleInput?.("\x1b[B");
      component.handleInput?.("\r");

      expect(doneFn).toHaveBeenCalledWith("beta");
    });

    it("calls done with null on escape", async () => {
      const doneFn = vi.fn();
      const { component } = await createFixture(
        "alpha\nbeta\n",
        undefined,
        doneFn,
      );

      component.handleInput?.("\x1b"); // Escape

      expect(doneFn).toHaveBeenCalledWith(null);
    });

    it("calls done with null when enter pressed with no candidates", async () => {
      const doneFn = vi.fn();
      const { component } = await createFixture("", undefined, doneFn);

      component.handleInput?.("\r"); // Enter with no candidates

      expect(doneFn).toHaveBeenCalledWith(null);
    });
  });

  describe("text input behavior", () => {
    it("resets selection to first item when typing changes query", async () => {
      const { component } = await createFixture("alpha\nbeta\ngamma\n");

      component.handleInput?.("\x1b[B");
      component.handleInput?.("\x1b[B");

      const resultBefore = component.render(120);

      // Type a new query — should reset selection to first match
      component.handleInput?.("g");

      const resultAfter = component.render(120);

      // The focused item should be different (gamma is now at index 0)
      expect(resultBefore).not.toEqual(resultAfter);
    });

    it("handles backspace in the input", async () => {
      const { component } = await createFixture("alpha\nbeta\ngamma\n");

      // Type "bet" then backspace to "be"
      component.handleInput?.("b");
      component.handleInput?.("e");
      component.handleInput?.("t");
      component.handleInput?.("\x7f");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("handles typed new bookmark name for creation", async () => {
      // When query doesn't match any existing bookmark, the last item is "new <query>"
      const { component } = await createFixture("main\nfeature-a\n");

      // Type a name that doesn't exist
      component.handleInput?.("new-feature");

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("different terminal widths", () => {
    it("renders at narrow width", async () => {
      const { component, tui } = await createFixture(
        "main\nfeature-a\nfix-bug\n",
      );
      (tui.terminal as TestTerminal).columns = 60;

      const result = component.render(60);
      expect(result).toMatchSnapshot();
    });

    it("renders at wide width", async () => {
      const { component, tui } = await createFixture(
        "main\nfeature-a\nfix-bug\n",
      );
      (tui.terminal as TestTerminal).columns = 160;

      const result = component.render(160);
      expect(result).toMatchSnapshot();
    });
  });
});
