import { describe, it, expect } from "vitest";
import { History } from "./history";
import type { EditorState } from "./types";

const createState = (lines: string[]): EditorState => ({
  lines,
  cursor: { line: 0, col: 0 },
  topLine: 0,
  selectionAnchor: null,
});

describe("History", () => {
  describe("given empty history", () => {
    describe("when undoing with no saved states", () => {
      it("then returns null", () => {
        const history = new History();
        const result = history.undo(createState([""]));

        expect(result).toBeNull();
      });
    });

    describe("when redoing with no future states", () => {
      it("then returns null", () => {
        const history = new History();
        const result = history.redo(createState([""]));

        expect(result).toBeNull();
      });
    });
  });

  describe("given saved state", () => {
    describe("when undoing once", () => {
      it("then restores the previous state", () => {
        const history = new History();
        const stateA = createState(["hello"]);
        const stateB = createState(["hello!"]);

        history.saveState(stateA);
        const result = history.undo(stateB);

        expect(result).toEqual(stateA);
      });
    });

    describe("when undoing multiple times", () => {
      it("then restores states in LIFO order", () => {
        const history = new History();
        const stateA = createState(["a"]);
        const stateB = createState(["b"]);
        const stateC = createState(["c"]);

        history.saveState(stateA);
        history.saveState(stateB);
        history.saveState(stateC);

        const undo1 = history.undo(createState(["final"]));
        expect(undo1?.lines).toEqual(["c"]);

        // Need to push C back as current for next undo
        const undo2 = history.undo(stateC);
        expect(undo2?.lines).toEqual(["b"]);
      });
    });
  });

  describe("given undone state", () => {
    describe("when redoing", () => {
      it("then restores the undone state", () => {
        const history = new History();
        const stateA = createState(["hello"]);
        const stateB = createState(["hello!"]);

        history.saveState(stateA);
        history.undo(stateB);
        const redoResult = history.redo(stateA);

        expect(redoResult?.lines).toEqual(["hello!"]);
      });
    });

    describe("when new save after undo", () => {
      it("then clears the future stack", () => {
        const history = new History();
        const stateA = createState(["a"]);
        const stateB = createState(["b"]);
        const stateC = createState(["c-new"]);

        history.saveState(stateA);
        history.undo(stateB);
        history.saveState(stateC);

        const redoResult = history.redo(stateC);
        expect(redoResult).toBeNull();
      });
    });
  });

  describe("given history capacity limit", () => {
    describe("when saving more than 500 states", () => {
      it("then drops oldest states", () => {
        const history = new History();

        for (let i = 0; i < 600; i++) {
          history.saveState(createState([`${i}`]));
        }

        const result = history.undo(createState(["final"]));
        expect(result?.lines).toEqual(["599"]);
      });
    });
  });

  describe("given clear", () => {
    describe("when clearing history", () => {
      it("then empties both past and future stacks", () => {
        const history = new History();
        history.saveState(createState(["a"]));
        history.saveState(createState(["b"]));

        history.clear();

        expect(history.undo(createState(["c"]))).toBeNull();
        expect(history.redo(createState(["c"]))).toBeNull();
      });
    });
  });

  describe("given cursor position in state", () => {
    describe("when undoing restores cursor", () => {
      it("then restores cursor position from saved state", () => {
        const history = new History();
        const stateA: EditorState = {
          lines: ["hello"],
          cursor: { line: 0, col: 3 },
          topLine: 0,
          selectionAnchor: null,
        };
        const stateB: EditorState = {
          lines: ["hello!"],
          cursor: { line: 0, col: 6 },
          topLine: 0,
          selectionAnchor: null,
        };

        history.saveState(stateA);
        const result = history.undo(stateB);

        expect(result?.cursor).toEqual({ line: 0, col: 3 });
      });
    });
  });

  describe("given topLine in state", () => {
    describe("when undoing restores scroll position", () => {
      it("then restores topLine from saved state", () => {
        const history = new History();
        const stateA: EditorState = {
          lines: ["a", "b", "c"],
          cursor: { line: 0, col: 0 },
          topLine: 5,
          selectionAnchor: null,
        };

        history.saveState(stateA);
        const result = history.undo({
          ...stateA,
          topLine: 10,
        });

        expect(result?.topLine).toBe(5);
      });
    });
  });
});
