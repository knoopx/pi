import { describe, it, expect } from "vitest";
import {
  findWordBoundaryBackward,
  findWordBoundaryForward,
  moveWordLeftOnLine,
  moveWordRightOnLine,
  clampCol,
  getLeadingWhitespace,
} from "./helpers";

describe("findWordBoundaryBackward", () => {
  describe("given 'hello world' at column 11", () => {
    describe("when finding word boundary backward", () => {
      it("then returns position 6 (start of 'world')", () => {
        const result = findWordBoundaryBackward("hello world", 11);

        expect(result).toBe(6);
      });
    });
  });

  describe("given 'hello   world' at column 13", () => {
    describe("when finding word boundary backward across spaces", () => {
      it("then skips whitespace and finds word start", () => {
        const result = findWordBoundaryBackward("hello   world", 13);

        expect(result).toBe(8);
      });
    });
  });

  describe("given 'hello' at column 0", () => {
    describe("when finding word boundary backward at start", () => {
      it("then returns 0", () => {
        const result = findWordBoundaryBackward("hello", 0);

        expect(result).toBe(0);
      });
    });
  });

  describe("given 'hello' at column 3", () => {
    describe("when finding word boundary backward mid-word", () => {
      it("then returns 0 (start of word)", () => {
        const result = findWordBoundaryBackward("hello", 3);

        expect(result).toBe(0);
      });
    });
  });
});

describe("findWordBoundaryForward", () => {
  describe("given 'hello world' at column 0", () => {
    describe("when finding word boundary forward", () => {
      it("then returns position past word and trailing space", () => {
        // skipCharsForward skips word chars then space chars
        const result = findWordBoundaryForward("hello world", 0, 11);

        expect(result).toBe(6); // skips "hello" + " "
      });
    });
  });

  describe("given 'hello world' at column 6", () => {
    describe("when finding word boundary forward", () => {
      it("then returns position 11 (end of 'world')", () => {
        const result = findWordBoundaryForward("hello world", 6, 11);

        expect(result).toBe(11);
      });
    });
  });

  describe("given 'hello' at column 5", () => {
    describe("when finding word boundary forward at end", () => {
      it("then returns the line length", () => {
        const result = findWordBoundaryForward("hello", 5, 5);

        expect(result).toBe(5);
      });
    });
  });

  describe("given 'hello   world' at column 5", () => {
    describe("when finding word boundary forward from space", () => {
      it("then skips word chars then spaces", () => {
        // At col 5 (space), skipCharsForward(\w) returns 5, then skipCharsForward(\s) returns 8
        const result = findWordBoundaryForward("hello   world", 5, 13);

        expect(result).toBe(8);
      });
    });
  });
});

describe("moveWordLeftOnLine", () => {
  describe("given cursor at column 8 in 'hello world'", () => {
    describe("when moving word left", () => {
      it("then moves to previous word boundary", () => {
        // From col 8: skipNonWord backward from 7 -> 7 (w is word)
        // charType at 7 is 'word', skipSameBackward from 7 goes to 6
        const cursor = { line: 0, col: 8 };
        moveWordLeftOnLine(["hello world"], cursor);

        expect(cursor.col).toBe(7);
      });
    });
  });

  describe("given cursor at column 0 in 'hello'", () => {
    describe("when moving word left at start", () => {
      it("then stays at column 0", () => {
        const cursor = { line: 0, col: 0 };
        moveWordLeftOnLine(["hello"], cursor);

        expect(cursor.col).toBe(0);
      });
    });
  });
});

describe("moveWordRightOnLine", () => {
  describe("given cursor at column 0 in 'hello world'", () => {
    describe("when moving word right", () => {
      it("then moves to end of current word (column 5)", () => {
        const cursor = { line: 0, col: 0 };
        moveWordRightOnLine(["hello world"], cursor);

        expect(cursor.col).toBe(5);
      });
    });
  });

  describe("given cursor at end of line", () => {
    describe("when moving word right past end", () => {
      it("then stays at end of line", () => {
        const cursor = { line: 0, col: 5 };
        moveWordRightOnLine(["hello"], cursor);

        expect(cursor.col).toBe(5);
      });
    });
  });
});

describe("clampCol", () => {
  describe("given cursor column exceeds line length", () => {
    describe("when clamping", () => {
      it("then sets column to line length", () => {
        const cursor = { line: 0, col: 100 };
        clampCol(["hello"], cursor);

        expect(cursor.col).toBe(5);
      });
    });
  });

  describe("given cursor column within bounds", () => {
    describe("when clamping", () => {
      it("then leaves column unchanged", () => {
        const cursor = { line: 0, col: 3 };
        clampCol(["hello"], cursor);

        expect(cursor.col).toBe(3);
      });
    });
  });
});

describe("getLeadingWhitespace", () => {
  describe("given '  hello'", () => {
    describe("when getting leading whitespace", () => {
      it("then returns the spaces", () => {
        expect(getLeadingWhitespace("  hello")).toBe("  ");
      });
    });
  });

  describe("given '\\thello'", () => {
    describe("when getting leading whitespace with tab", () => {
      it("then returns the tab", () => {
        expect(getLeadingWhitespace("\thello")).toBe("\t");
      });
    });
  });

  describe("given 'hello' (no whitespace)", () => {
    describe("when getting leading whitespace", () => {
      it("then returns empty string", () => {
        expect(getLeadingWhitespace("hello")).toBe("");
      });
    });
  });

  describe("given '' (empty string)", () => {
    describe("when getting leading whitespace", () => {
      it("then returns empty string", () => {
        expect(getLeadingWhitespace("")).toBe("");
      });
    });
  });

  describe("given '   ' (only whitespace)", () => {
    describe("when getting leading whitespace", () => {
      it("then returns the full string", () => {
        expect(getLeadingWhitespace("   ")).toBe("   ");
      });
    });
  });
});
