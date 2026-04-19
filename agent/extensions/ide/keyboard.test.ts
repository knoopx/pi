import { describe, it, expect, vi } from "vitest";
import {
  createKeyboardHandler,
  buildHelpFromBindings,
  type KeyBinding,
} from "./keyboard";

describe("createKeyboardHandler", () => {
  describe("given custom key bindings", () => {
    describe("when matching key is pressed", () => {
      it("then calls the handler", () => {
        const handler = vi.fn().mockReturnValue(true);
        const keyHandler = createKeyboardHandler({
          bindings: [{ key: "ctrl+d", handler }],
        });

        const result = keyHandler("\x04"); // Ctrl+D
        expect(handler).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe("when handler returns false", () => {
      it("then continues to next binding", () => {
        const firstHandler = vi.fn().mockReturnValue(false);
        const secondHandler = vi.fn().mockReturnValue(true);
        const keyHandler = createKeyboardHandler({
          bindings: [
            { key: "ctrl+d", handler: firstHandler },
            { key: "ctrl+d", handler: secondHandler },
          ],
        });

        keyHandler("\x04");
        expect(firstHandler).toHaveBeenCalled();
        expect(secondHandler).toHaveBeenCalled();
      });
    });

    describe("when binding has 'when' condition", () => {
      it("then skips if condition returns false", () => {
        const handler = vi.fn().mockReturnValue(true);
        const keyHandler = createKeyboardHandler({
          bindings: [
            {
              key: "ctrl+d",
              handler,
              when: () => false,
            },
          ],
        });

        const result = keyHandler("\x04");
        expect(handler).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it("then executes if condition returns true", () => {
        const handler = vi.fn().mockReturnValue(true);
        const keyHandler = createKeyboardHandler({
          bindings: [
            {
              key: "ctrl+d",
              handler,
              when: () => true,
            },
          ],
        });

        keyHandler("\x04");
        expect(handler).toHaveBeenCalled();
      });
    });

    describe("when context is provided", () => {
      it("then passes context to handlers", () => {
        interface TestContext {
          value: number;
        }

        const handler = vi.fn().mockReturnValue(true);
        const context: TestContext = { value: 42 };

        const keyHandler = createKeyboardHandler<TestContext>({
          bindings: [{ key: "enter", handler }],
          getContext: () => context,
        });

        keyHandler("\r");
        expect(handler).toHaveBeenCalledWith(context);
      });
    });

    describe("when handler returns a Promise", () => {
      it("then treats the binding as successfully handled", () => {
        const handler = vi
          .fn()
          .mockReturnValue(
            new Promise<void>((resolve) => setTimeout(resolve, 10)),
          );
        const keyHandler = createKeyboardHandler({
          bindings: [{ key: "enter", handler }],
        });

        const result = keyHandler("\r");
        expect(handler).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it("then suppresses unhandled rejections", () => {
        const handler = vi
          .fn()
          .mockReturnValue(Promise.reject(new Error("fail")));
        const keyHandler = createKeyboardHandler({
          bindings: [{ key: "enter", handler }],
        });

        // Should not throw - the rejection is caught internally
        expect(() => keyHandler("\r")).not.toThrow();
      });
    });
  });

  describe("given escape handler", () => {
    describe("when escape key is pressed", () => {
      it("then calls onEscape", () => {
        const onEscape = vi.fn();
        const keyHandler = createKeyboardHandler({ onEscape });

        const result = keyHandler("\x1b");
        expect(onEscape).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });
  });

  describe("given enter handler", () => {
    describe("when enter key is pressed", () => {
      it("then calls onEnter", () => {
        const onEnter = vi.fn();
        const keyHandler = createKeyboardHandler({ onEnter });

        const result = keyHandler("\r");
        expect(onEnter).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });
  });

  describe("given navigation config", () => {
    describe("when up arrow is pressed", () => {
      it("then decrements index", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 5, maxIndex: 10 }),
          onNavigate,
        });

        keyHandler("\x1b[A"); // Up arrow
        expect(onNavigate).toHaveBeenCalledWith(4);
      });

      it("then does not go below 0", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 0, maxIndex: 10 }),
          onNavigate,
        });

        const result = keyHandler("\x1b[A");
        expect(onNavigate).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });

    describe("when down arrow is pressed", () => {
      it("then increments index", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 5, maxIndex: 10 }),
          onNavigate,
        });

        keyHandler("\x1b[B"); // Down arrow
        expect(onNavigate).toHaveBeenCalledWith(6);
      });

      it("then does not exceed maxIndex", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 10, maxIndex: 10 }),
          onNavigate,
        });

        const result = keyHandler("\x1b[B");
        expect(onNavigate).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });

    describe("when page up is pressed", () => {
      it("then jumps up by page size", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 15, maxIndex: 30, pageSize: 10 }),
          onNavigate,
        });

        keyHandler("\x1b[5~"); // Page Up
        expect(onNavigate).toHaveBeenCalledWith(5);
      });

      it("then uses default page size of 10", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 25, maxIndex: 30 }),
          onNavigate,
        });

        keyHandler("\x1b[5~");
        expect(onNavigate).toHaveBeenCalledWith(15);
      });

      it("then clamps to 0", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 3, maxIndex: 30, pageSize: 10 }),
          onNavigate,
        });

        keyHandler("\x1b[5~");
        expect(onNavigate).toHaveBeenCalledWith(0);
      });
    });

    describe("when page down is pressed", () => {
      it("then jumps down by page size", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 5, maxIndex: 30, pageSize: 10 }),
          onNavigate,
        });

        keyHandler("\x1b[6~"); // Page Down
        expect(onNavigate).toHaveBeenCalledWith(15);
      });

      it("then clamps to maxIndex", () => {
        const onNavigate = vi.fn();
        const keyHandler = createKeyboardHandler({
          navigation: () => ({ index: 25, maxIndex: 30, pageSize: 10 }),
          onNavigate,
        });

        keyHandler("\x1b[6~");
        expect(onNavigate).toHaveBeenCalledWith(30);
      });
    });
  });

  describe("given backspace handler", () => {
    describe("when backspace is pressed", () => {
      it("then calls onBackspace for DEL character", () => {
        const onBackspace = vi.fn();
        const keyHandler = createKeyboardHandler({ onBackspace });

        const result = keyHandler("\x7f");
        expect(onBackspace).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it("then calls onBackspace for BS character", () => {
        const onBackspace = vi.fn();
        const keyHandler = createKeyboardHandler({ onBackspace });

        const result = keyHandler("\b");
        expect(onBackspace).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });
  });

  describe("given text input handler", () => {
    describe("when printable character is pressed", () => {
      it("then calls onTextInput with character", () => {
        const onTextInput = vi.fn();
        const keyHandler = createKeyboardHandler({ onTextInput });

        const result = keyHandler("a");
        expect(onTextInput).toHaveBeenCalledWith("a");
        expect(result).toBe(true);
      });
    });

    describe("when space is pressed", () => {
      it("then calls onTextInput", () => {
        const onTextInput = vi.fn();
        const keyHandler = createKeyboardHandler({ onTextInput });

        keyHandler(" ");
        expect(onTextInput).toHaveBeenCalledWith(" ");
      });
    });

    describe("when tilde is pressed", () => {
      it("then calls onTextInput", () => {
        const onTextInput = vi.fn();
        const keyHandler = createKeyboardHandler({ onTextInput });

        keyHandler("~");
        expect(onTextInput).toHaveBeenCalledWith("~");
      });
    });

    describe("when non-printable character is pressed", () => {
      it("then does not call onTextInput", () => {
        const onTextInput = vi.fn();
        const keyHandler = createKeyboardHandler({ onTextInput });

        const result = keyHandler("\x01"); // Ctrl+A
        expect(onTextInput).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });
    });
  });

  describe("given no matching handlers", () => {
    describe("when unhandled key is pressed", () => {
      it("then returns false", () => {
        const keyHandler = createKeyboardHandler({});
        const result = keyHandler("\x01");
        expect(result).toBe(false);
      });
    });
  });
});

describe("buildHelpFromBindings", () => {
  describe("given bindings with labels", () => {
    describe("when building help text", () => {
      it("then includes labeled bindings", () => {
        const bindings: KeyBinding[] = [
          { key: "ctrl+d", label: "delete", handler: () => {} },
          { key: "enter", label: "select", handler: () => {} },
        ];

        const help = buildHelpFromBindings(bindings);
        expect(help).toContain("ctrl+d delete");
        expect(help).toContain("enter select");
      });
    });
  });

  describe("given bindings without labels", () => {
    describe("when building help text", () => {
      it("then excludes unlabeled bindings", () => {
        const bindings: KeyBinding[] = [
          { key: "ctrl+d", label: "delete", handler: () => {} },
          { key: "ctrl+x", handler: () => {} }, // No label
        ];

        const help = buildHelpFromBindings(bindings);
        expect(help).toContain("delete");
        expect(help).not.toContain("ctrl+x");
      });
    });
  });

  describe("given special key patterns", () => {
    describe("when formatting keys", () => {
      it("then converts arrow keys to symbols", () => {
        const bindings: KeyBinding[] = [
          { key: "up", label: "up", handler: () => {} },
          { key: "down", label: "down", handler: () => {} },
        ];

        const help = buildHelpFromBindings(bindings);
        expect(help).toContain("↑");
        expect(help).toContain("↓");
      });

      it("then converts page keys to abbreviations", () => {
        const bindings: KeyBinding[] = [
          { key: "pageUp", label: "page", handler: () => {} },
          { key: "pageDown", label: "page", handler: () => {} },
        ];

        const help = buildHelpFromBindings(bindings);
        expect(help).toContain("pgup");
        expect(help).toContain("pgdn");
      });

      it("then converts escape to esc", () => {
        const bindings: KeyBinding[] = [
          { key: "escape", label: "exit", handler: () => {} },
        ];

        const help = buildHelpFromBindings(bindings);
        expect(help).toContain("esc");
      });
    });
  });

  describe("given empty bindings", () => {
    describe("when building help text", () => {
      it("then returns empty string", () => {
        expect(buildHelpFromBindings([])).toBe("");
      });
    });
  });
});
