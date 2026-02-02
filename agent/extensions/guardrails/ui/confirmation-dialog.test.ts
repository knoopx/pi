// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, it, expect, vi } from "vitest";
import { createConfirmationDialog } from "./confirmation-dialog";

describe("ConfirmationDialog", () => {
  const createMockTheme = () => ({
    fg: vi.fn((color: string, text: string) => `${color}:${text}`),
    bold: vi.fn((text: string) => `**${text}**`),
  });

  describe("given basic options", () => {
    it("then creates dialog component", () => {
      const theme = createMockTheme();
      const done = vi.fn();

      const dialog = createConfirmationDialog(
        {
          title: "Test Title",
          message: "Test Message",
        },
        theme,
        done,
      );

      expect(dialog).toBeDefined();
      expect(dialog.render).toBeInstanceOf(Function);
      expect(dialog.invalidate).toBeInstanceOf(Function);
      expect(dialog.handleInput).toBeInstanceOf(Function);
    });
  });

  describe("given danger option", () => {
    it("then uses error color for borders", () => {
      const theme = createMockTheme();
      const done = vi.fn();

      const dialog = createConfirmationDialog(
        {
          title: "Danger Title",
          message: "Danger Message",
          danger: true,
        },
        theme,
        done,
      );

      dialog.render(80);

      // Should have called fg with "error" for borders
      expect(theme.fg).toHaveBeenCalledWith("error", expect.any(String));
    });
  });

  describe("given content option", () => {
    it("then renders without error", () => {
      const theme = createMockTheme();
      const done = vi.fn();

      const dialog = createConfirmationDialog(
        {
          title: "Title",
          message: "Message",
          content: "Some content",
        },
        theme,
        done,
      );

      const output = dialog.render(80);

      expect(Array.isArray(output)).toBe(true);
      expect(output.length).toBeGreaterThan(5); // Should have more lines with content
    });
  });

  describe("given custom confirm/cancel text", () => {
    it("then uses custom text", () => {
      const theme = createMockTheme();
      const done = vi.fn();

      const dialog = createConfirmationDialog(
        {
          title: "Title",
          message: "Message",
          confirmText: "yes: proceed",
          cancelText: "no: stop",
        },
        theme,
        done,
      );

      const output = dialog.render(80);

      expect(output.some((line) => line.includes("yes: proceed"))).toBe(true);
      expect(output.some((line) => line.includes("no: stop"))).toBe(true);
    });
  });

  describe("handleInput", () => {
    describe("given enter key", () => {
      it("then calls done with true", () => {
        const theme = createMockTheme();
        const done = vi.fn();

        const dialog = createConfirmationDialog(
          { title: "Title", message: "Message" },
          theme,
          done,
        );

        dialog.handleInput("\r"); // Enter key

        expect(done).toHaveBeenCalledWith(true);
      });
    });

    describe("given y key", () => {
      it("then calls done with true", () => {
        const theme = createMockTheme();
        const done = vi.fn();

        const dialog = createConfirmationDialog(
          { title: "Title", message: "Message" },
          theme,
          done,
        );

        dialog.handleInput("y");

        expect(done).toHaveBeenCalledWith(true);
      });
    });

    describe("given Y key", () => {
      it("then calls done with true", () => {
        const theme = createMockTheme();
        const done = vi.fn();

        const dialog = createConfirmationDialog(
          { title: "Title", message: "Message" },
          theme,
          done,
        );

        dialog.handleInput("Y");

        expect(done).toHaveBeenCalledWith(true);
      });
    });

    describe("given escape key", () => {
      it("then calls done with false", () => {
        const theme = createMockTheme();
        const done = vi.fn();

        const dialog = createConfirmationDialog(
          { title: "Title", message: "Message" },
          theme,
          done,
        );

        dialog.handleInput("\x1b"); // Escape key

        expect(done).toHaveBeenCalledWith(false);
      });
    });

    describe("given n key", () => {
      it("then calls done with false", () => {
        const theme = createMockTheme();
        const done = vi.fn();

        const dialog = createConfirmationDialog(
          { title: "Title", message: "Message" },
          theme,
          done,
        );

        dialog.handleInput("n");

        expect(done).toHaveBeenCalledWith(false);
      });
    });

    describe("given N key", () => {
      it("then calls done with false", () => {
        const theme = createMockTheme();
        const done = vi.fn();

        const dialog = createConfirmationDialog(
          { title: "Title", message: "Message" },
          theme,
          done,
        );

        dialog.handleInput("N");

        expect(done).toHaveBeenCalledWith(false);
      });
    });

    describe("given other key", () => {
      it("then does not call done", () => {
        const theme = createMockTheme();
        const done = vi.fn();

        const dialog = createConfirmationDialog(
          { title: "Title", message: "Message" },
          theme,
          done,
        );

        dialog.handleInput("x");

        expect(done).not.toHaveBeenCalled();
      });
    });
  });

  describe("render", () => {
    it("then returns array of strings", () => {
      const theme = createMockTheme();
      const done = vi.fn();

      const dialog = createConfirmationDialog(
        {
          title: "Test Dialog",
          message: "This is a test",
          content: "Some content here",
        },
        theme,
        done,
      );

      const output = dialog.render(80);

      expect(Array.isArray(output)).toBe(true);
      expect(output.length).toBeGreaterThan(0);
      expect(typeof output[0]).toBe("string");
    });

    it("then includes title in output", () => {
      const theme = createMockTheme();
      const done = vi.fn();

      const dialog = createConfirmationDialog(
        { title: "My Title", message: "Message" },
        theme,
        done,
      );

      const output = dialog.render(80);

      expect(output.some((line) => line.includes("My Title"))).toBe(true);
    });
  });

  describe("invalidate", () => {
    it("then calls container invalidate", () => {
      const theme = createMockTheme();
      const done = vi.fn();

      const dialog = createConfirmationDialog(
        { title: "Title", message: "Message" },
        theme,
        done,
      );

      // Should not throw
      expect(() => dialog.invalidate()).not.toThrow();
    });
  });
});
