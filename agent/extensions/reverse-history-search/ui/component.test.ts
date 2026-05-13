import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import {
  createMockTheme,
  TestTerminal,
} from "../../../shared/testing/mock-theme";
import { HistorySearchComponent, makeHistorySearchRenderer } from "./component";
import type { HistoryEntry } from "../types";

// Raw terminal escape sequences for key testing
const ESC = "\x1b";
const ENTER = "\r";
const UP = `${ESC}[A`;
const DOWN = `${ESC}[B`;
const PAGE_UP = `${ESC}[5~`;
const PAGE_DOWN = `${ESC}[6~`;
const HOME = `${ESC}[H`;
const END = `${ESC}[F`;
const BACKSPACE = "\x7f";
const DELETE = `${ESC}[3~`;
const CTRL_SLASH = `${ESC}[27;5;47~`; // Kitty protocol ctrl+/

function createMockTui(): TUI {
  const terminal = new TestTerminal(120, 30);
  return {
    terminal,
    requestRender: vi.fn(),
    children: [],
    focusedComponent: null,
    inputListeners: new Set(),
    render: vi.fn().mockReturnValue([]),
    invalidate: vi.fn(),
    setFocus: vi.fn(),
  } as unknown as TUI;
}

function createSampleHistory(): HistoryEntry[] {
  const now = Date.now();
  return [
    { content: "git status", timestamp: now - 100000, type: "command" },
    { content: "npm install express", timestamp: now - 90000, type: "command" },
    { content: "bun run build", timestamp: now - 80000, type: "command" },
    {
      content: "Fix the rendering issue in the split panel",
      timestamp: now - 70000,
      type: "message",
    },
    { content: "jj log --no-graph", timestamp: now - 60000, type: "command" },
  ];
}

describe("HistorySearchComponent", () => {
  let theme: Theme;
  let history: HistoryEntry[];
  let component: HistorySearchComponent;

  beforeEach(() => {
    theme = createMockTheme();
    history = createSampleHistory();
    component = new HistorySearchComponent(theme, history);
  });

  describe("given a fresh component", () => {
    it("then it should display all items with Messages filter by default", (): void => {
      const lines = component.render(120);
      expect(lines.length).toBeGreaterThan(3);
      expect(component.getFilterName()).toBe("Messages");
    });

    it("then selectedIndex should start at 0", (): void => {
      expect(component["selectedIndex"]).toBe(0);
    });

    it("then query should be empty", (): void => {
      expect(component["query"]).toBe("");
    });
  });

  describe("when Enter is pressed with items available", () => {
    it("then it should call onSelect with the selected item", (): void => {
      const onSelect = vi.fn();
      component.onSelect = onSelect;

      component.handleInput(ENTER);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(history[0]);
    });

    it("then it should call onSelect with the currently selected item after navigation", (): void => {
      const onSelect = vi.fn();
      component.onSelect = onSelect;

      component.handleInput(DOWN);
      component.handleInput(ENTER);

      expect(onSelect).toHaveBeenCalledWith(history[1]);
    });
  });

  describe("when Enter is pressed with no items", () => {
    it("then it should NOT call onSelect", (): void => {
      const onSelect = vi.fn();
      component.onSelect = onSelect;

      component.handleInput("z");
      component.handleInput("x");
      component.handleInput("y");

      component.handleInput(ENTER);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("when Escape is pressed", () => {
    it("then it should call onCancel", (): void => {
      const onCancel = vi.fn();
      component.onCancel = onCancel;

      component.handleInput(ESC);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("when navigating with up/down keys", () => {
    it("then down should increment the selected index", (): void => {
      component.handleInput(DOWN);
      expect(component["selectedIndex"]).toBe(1);

      component.handleInput(DOWN);
      expect(component["selectedIndex"]).toBe(2);
    });

    it("then up should decrement the selected index", (): void => {
      component.handleInput(DOWN);
      component.handleInput(DOWN);
      expect(component["selectedIndex"]).toBe(2);

      component.handleInput(UP);
      expect(component["selectedIndex"]).toBe(1);
    });

    it("then down should not go past the last item", (): void => {
      for (let i = 0; i < 10; i++) {
        component.handleInput(DOWN);
      }
      const maxIndex = history.length - 1;
      expect(component["selectedIndex"]).toBe(maxIndex);
    });

    it("then up should not go below 0", (): void => {
      component.handleInput(UP);
      expect(component["selectedIndex"]).toBe(0);
    });
  });

  describe("when navigating with pageUp/pageDown keys", () => {
    it("then pageDown should jump by page offset", (): void => {
      component.handleInput(PAGE_DOWN);
      expect(component["selectedIndex"]).toBe(4);
    });

    it("then pageUp from bottom should go to top of page", (): void => {
      component.handleInput(PAGE_DOWN);
      component.handleInput(PAGE_UP);
      expect(component["selectedIndex"]).toBe(0);
    });
  });

  describe("when navigating with home/end keys", () => {
    it("then end should select the last item", (): void => {
      component.handleInput(DOWN);
      component.handleInput(END);
      expect(component["selectedIndex"]).toBe(history.length - 1);
    });

    it("then home should select the first item", (): void => {
      for (let i = 0; i < 10; i++) {
        component.handleInput(DOWN);
      }
      component.handleInput(HOME);
      expect(component["selectedIndex"]).toBe(0);
    });
  });

  describe("when typing characters", () => {
    it("then it should filter results by the query on current filter", (): void => {
      component.handleInput("F");
      component.handleInput("i");
      component.handleInput("x");

      const filtered = component["filteredHistory"];
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered[0].content).toContain("Fix");
    });

    it("then switching to Commands filter should match commands", (): void => {
      component.handleInput(CTRL_SLASH);
      expect(component.getFilterName()).toBe("Commands");

      component.handleInput("g");
      component.handleInput("i");
      component.handleInput("t");

      const filtered = component["filteredHistory"];
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered[0].content).toContain("git");
    });

    it("then backspace should remove the last character", (): void => {
      component.handleInput("g");
      component.handleInput("i");
      expect(component["query"]).toBe("gi");

      component.handleInput(BACKSPACE);
      expect(component["query"]).toBe("g");
    });

    it("then delete key should remove the last character", (): void => {
      component.handleInput("g");
      component.handleInput("i");
      expect(component["query"]).toBe("gi");

      component.handleInput(DELETE);
      expect(component["query"]).toBe("g");
    });
  });

  describe("when cycling filter with ctrl+/", () => {
    it("then it should switch from Messages to Commands", (): void => {
      expect(component.getFilterName()).toBe("Messages");

      component.handleInput(CTRL_SLASH);

      expect(component.getFilterName()).toBe("Commands");
    });

    it("then it should reset selected index when filter changes", (): void => {
      component.handleInput(DOWN);
      component.handleInput(DOWN);
      expect(component["selectedIndex"]).toBe(2);

      component.handleInput(CTRL_SLASH);
      expect(component["selectedIndex"]).toBe(0);
    });

    it("then cycling again should go back to Messages", (): void => {
      component.handleInput(CTRL_SLASH);
      component.handleInput(CTRL_SLASH);
      expect(component.getFilterName()).toBe("Messages");
    });
  });

  describe("when rendering after state changes", () => {
    it("then it should invalidate cache on state change", (): void => {
      component.render(120);
      expect(component["cachedLines"]).toBeDefined();

      component.handleInput(DOWN);
      expect(component["cachedWidth"]).toBeUndefined();
    });
  });

  describe("given filtered results with navigation", () => {
    it("then selected index should clamp to filtered range after filter change", (): void => {
      for (let i = 0; i < 10; i++) {
        component.handleInput(DOWN);
      }
      expect(component["selectedIndex"]).toBe(history.length - 1);

      component.handleInput(CTRL_SLASH);
      component.handleInput("g");

      // Index should be clamped to filtered range
      const filtered = component["filteredHistory"];
      expect(component["selectedIndex"]).toBeLessThan(filtered.length);
    });
  });
});

// Helper: type a string character by character via handleInput
function typeQuery(
  renderer: ReturnType<typeof makeHistorySearchRenderer>,
  str: string,
): void {
  for (const char of str) {
    renderer.handleInput(char);
  }
}

// Helper: assert done was called with an entry containing the expected substring
function expectDoneCalledWithSubstring(
  doneCb: ReturnType<typeof vi.fn<(result: HistoryEntry | null) => void>>,
  substring: string,
): void {
  expect(doneCb).toHaveBeenCalledTimes(1);
  const calledWith = doneCb.mock.calls[0][0] as HistoryEntry;
  expect(calledWith.content).toContain(substring);
}

describe("makeHistorySearchRenderer", () => {
  let theme: Theme;
  let history: HistoryEntry[];
  let mockTui: TUI;
  let doneCallback: ReturnType<
    typeof vi.fn<(result: HistoryEntry | null) => void>
  >;

  beforeEach(() => {
    theme = createMockTheme();
    history = createSampleHistory();
    doneCallback = vi.fn();
    mockTui = createMockTui();
  });

  describe("given a renderer with history", () => {
    let renderer: ReturnType<typeof makeHistorySearchRenderer>;

    beforeEach(() => {
      renderer = makeHistorySearchRenderer(
        theme,
        history,
        doneCallback,
        mockTui,
      );
    });

    it("then it should provide render method", (): void => {
      expect(typeof renderer.render).toBe("function");
    });

    it("then it should provide invalidate method", (): void => {
      expect(typeof renderer.invalidate).toBe("function");
    });

    it("then it should provide handleInput method", (): void => {
      expect(typeof renderer.handleInput).toBe("function");
    });

    describe("when Enter is pressed with items", () => {
      it("then it should call done with the selected item", (): void => {
        renderer.handleInput(ENTER);

        expect(doneCallback).toHaveBeenCalledTimes(1);
        expect(doneCallback).toHaveBeenCalledWith(history[0]);
      });
    });

    describe("when Escape is pressed", () => {
      it("then it should call done with null (dismissal)", (): void => {
        renderer.handleInput(ESC);

        expect(doneCallback).toHaveBeenCalledTimes(1);
        expect(doneCallback).toHaveBeenCalledWith(null);
      });
    });

    describe("when navigating then confirming selection", () => {
      it("then it should call done with the navigated item", (): void => {
        renderer.handleInput(DOWN);
        renderer.handleInput(ENTER);

        expect(doneCallback).toHaveBeenCalledTimes(1);
        expect(doneCallback).toHaveBeenCalledWith(history[1]);
      });
    });

    describe("when typing a query then confirming", () => {
      it("then it should call done with the first matching item on current filter", (): void => {
        typeQuery(renderer, "Fix");

        renderer.handleInput(ENTER);

        expectDoneCalledWithSubstring(doneCallback, "Fix");
      });

      it("then switching to Commands and typing should match a command", (): void => {
        renderer.handleInput(CTRL_SLASH);

        typeQuery(renderer, "bun");

        renderer.handleInput(ENTER);

        expectDoneCalledWithSubstring(doneCallback, "bun");
      });
    });

    describe("when requestRender is called", () => {
      it("then handleInput should trigger a render request", (): void => {
        renderer.handleInput(DOWN);

        expect(mockTui.requestRender).toHaveBeenCalledTimes(1);
      });

      it("then handleInput for enter should trigger a render request", (): void => {
        renderer.handleInput(ENTER);

        expect(mockTui.requestRender).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("given empty history", () => {
    let renderer: ReturnType<typeof makeHistorySearchRenderer>;

    beforeEach(() => {
      renderer = makeHistorySearchRenderer(theme, [], doneCallback, mockTui);
    });

    it("then Enter should NOT call done with an item", (): void => {
      renderer.handleInput(ENTER);

      expect(doneCallback).not.toHaveBeenCalled();
    });

    it("then Escape should still call done with null", (): void => {
      renderer.handleInput(ESC);

      expect(doneCallback).toHaveBeenCalledTimes(1);
      expect(doneCallback).toHaveBeenCalledWith(null);
    });
  });
});

describe("full integration: makeHistorySearchRenderer → ctx.ui.custom flow", () => {
  let theme: Theme;
  let history: HistoryEntry[];
  let doneCallback: ReturnType<
    typeof vi.fn<(result: HistoryEntry | null) => void>
  >;
  let mockTui: TUI;

  beforeEach(() => {
    theme = createMockTheme();
    history = createSampleHistory();
    doneCallback = vi.fn();
    mockTui = createMockTui();
  });

  describe("when user selects a command entry", () => {
    it("then done should be called with the command entry", (): void => {
      const renderer = makeHistorySearchRenderer(
        theme,
        history,
        doneCallback,
        mockTui,
      );
      renderer.handleInput(ENTER);

      const result = doneCallback.mock.calls[0][0] as HistoryEntry;
      expect(result.type).toBe("command");
      expect(result.content).toBe("git status");
    });
  });

  describe("when user selects a message entry after filtering", () => {
    it("then done should be called with the message entry", (): void => {
      const renderer = makeHistorySearchRenderer(
        theme,
        history,
        doneCallback,
        mockTui,
      );

      renderer.handleInput("F");
      renderer.handleInput("i");
      renderer.handleInput("x");

      renderer.handleInput(ENTER);

      const result = doneCallback.mock.calls[0][0] as HistoryEntry;
      expect(result.type).toBe("message");
      expect(result.content).toContain("Fix");
    });
  });

  describe("when user dismisses with Escape", () => {
    it("then done should be called with null", (): void => {
      const renderer = makeHistorySearchRenderer(
        theme,
        history,
        doneCallback,
        mockTui,
      );

      renderer.handleInput(DOWN);
      renderer.handleInput(ESC);

      expect(doneCallback).toHaveBeenCalledWith(null);
    });
  });

  describe("when user navigates to last item and confirms", () => {
    it("then done should be called with the last matching item", (): void => {
      const renderer = makeHistorySearchRenderer(
        theme,
        history,
        doneCallback,
        mockTui,
      );

      renderer.handleInput(CTRL_SLASH);
      for (let i = 0; i < 5; i++) {
        renderer.handleInput(DOWN);
      }

      renderer.handleInput(ENTER);

      const result = doneCallback.mock.calls[0][0] as HistoryEntry;
      expect(result.type).toBe("command");
    });
  });
});
