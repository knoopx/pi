import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/**
 * Generic mock factory for chokidar
 */
export function createMockChokidar(): {
  fsWatcher: { on: Mock; close: Mock };
  mockWatch: Mock;
} {
  const fsWatcher = {
    on: vi.fn().mockImplementation(() => fsWatcher),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockWatch = vi.fn().mockReturnValue(fsWatcher);

  return { fsWatcher, mockWatch };
}

/**
 * Generic mock factory for PI extension API
 */
export function createMockPI(): {
  exec: Mock;
  sendUserMessage: Mock;
} {
  return {
    exec: vi.fn(),
    sendUserMessage: vi.fn(),
  };
}

/**
 * Generic mock factory for TUI
 */
export function createMockTUI(rows = 24): {
  terminal: { rows: number };
  requestRender: Mock;
} {
  return {
    terminal: { rows },
    requestRender: vi.fn(),
  };
}

/**
 * Generic mock factory for theme
 */
export function createMockTheme(): {
  fg: Mock;
  bold: Mock;
} {
  return {
    fg: vi.fn().mockImplementation((color, text) => text),
    bold: vi.fn().mockImplementation((text) => text),
  };
}

/**
 * Generic test setup for component tests
 */
export function createComponentTestSetup<T extends Record<string, unknown>>(
  componentFactory: (args: T) => {
    render: Mock;
    handleInput: Mock;
    dispose: Mock;
  },
  defaultArgs: T,
) {
  return {
    setup: (overrides: Partial<T> = {}) => {
      const args = { ...defaultArgs, ...overrides };
      const component = componentFactory(args as T);
      return { component, args };
    },

    testBasicRendering: (component: { render: Mock }) => {
      it("renders without crashing", () => {
        const lines = component.render(80);
        expect(lines).toBeDefined();
        expect(Array.isArray(lines)).toBe(true);
      });
    },

    testInputHandling: (
      component: { handleInput: Mock },
      inputs: Array<{ input: string; description: string }>,
    ) => {
      inputs.forEach(({ input, description }) => {
        it(`handles ${description}`, () => {
          component.handleInput(input);
          // Add specific assertions as needed
        });
      });
    },

    testCleanup: (component: { dispose: Mock }) => {
      it("cleans up resources on dispose", () => {
        component.dispose();
        // Add specific cleanup assertions as needed
      });
    },
  };
}

/**
 * Generic test helpers for async operations
 */
export function createAsyncTestHelpers() {
  return {
    waitForRender: (requestRender: Mock) =>
      new Promise<void>((resolve) => {
        requestRender.mockImplementation(() => resolve());
      }),

    expectCalledWith: (mock: Mock, ...args: unknown[]) => {
      expect(mock).toHaveBeenCalledWith(...args);
    },

    expectCalledTimes: (mock: Mock, times: number) => {
      expect(mock).toHaveBeenCalledTimes(times);
    },
  };
}

/**
 * Generic mock data factories
 */
export function createMockData() {
  return {
    createMockFileChange: (path: string, status: string = "modified") => ({
      path,
      status,
      oldPath: undefined,
    }),

    createMockChange: (
      changeId: string,
      description: string = "test change",
    ) => ({
      changeId,
      description,
      author: "test@example.com",
      date: new Date().toISOString(),
    }),

    createMockWorkspace: (name: string, status: string = "idle") => ({
      name,
      path: `/tmp/${name}`,
      description: `Test ${name} workspace`,
      status,
      changeId: "abc123",
      parentChangeId: "",
      createdAt: Date.now(),
      fileStats: { added: 0, modified: 1, deleted: 0 },
    }),
  };
}

/**
 * Generic test patterns for common scenarios
 */
export function createTestPatterns() {
  return {
    testLoadingStates: (render: Mock) => {
      describe("loading states", () => {
        it("shows loading indicator initially", () => {
          const lines = render(80);
          expect(lines.some((line: string) => line.includes("Loading"))).toBe(
            true,
          );
        });
      });
    },

    testEmptyStates: (render: Mock) => {
      describe("empty states", () => {
        it("shows appropriate message when no data", () => {
          const lines = render(80);
          expect(
            lines.some(
              (line: string) => line.includes("No") || line.includes("Empty"),
            ),
          ).toBe(true);
        });
      });
    },

    testNavigation: (handleInput: Mock, render: Mock) => {
      describe("navigation", () => {
        beforeEach(() => {
          render.mockClear();
        });

        it("handles up arrow", () => {
          handleInput("\u001b[A"); // Up arrow
          expect(render).toHaveBeenCalled();
        });

        it("handles down arrow", () => {
          handleInput("\u001b[B"); // Down arrow
          expect(render).toHaveBeenCalled();
        });

        it("handles tab for focus switching", () => {
          handleInput("\t");
          expect(render).toHaveBeenCalled();
        });
      });
    },

    testErrorHandling: (render: Mock) => {
      describe("error handling", () => {
        it("displays error messages appropriately", () => {
          const lines = render(80);
          // Check for error message patterns
          expect(
            lines.some(
              (line: string) =>
                line.includes("Error") || line.includes("Failed"),
            ),
          ).toBe(false); // Should not show errors in normal cases
        });
      });
    },
  };
}
