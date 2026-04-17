import { describe, it, expect } from "vitest";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { renderFileChangeRows } from "./content";
import { createMockTheme } from "../test-utils";

function createMockExtendedTheme(): Theme {
  const base = createMockTheme();
  return {
    ...base,
    italic: (t: string) => `*${t}*`,
    underline: (t: string) => `_${t}_`,
  } as unknown as Theme;
}

const theme = createMockExtendedTheme();
const width = 80;
const height = 10;

function renderHighlighted(
  files: {
    status: string;
    path: string;
    insertions: number;
    deletions: number;
  }[],
): void {
  const result = renderFileChangeRows(files, width, height, 0, theme);
  expect(result).toMatchSnapshot();
}

function selectedAndFocused(
  files: {
    status: string;
    path: string;
    insertions: number;
    deletions: number;
  }[],
) {
  describe("when selected and focused", () => {
    it("renders with selection highlight", () => renderHighlighted(files));
  });
}

describe("renderFileChangeRows — status icon and file icon layout", () => {
  describe("given an empty list", () => {
    it("renders the empty message", () => {
      const result = renderFileChangeRows([], width, height, 0, theme);
      expect(result).toMatchSnapshot();
    });

    it("renders with custom empty message", () => {
      const result = renderFileChangeRows(
        [],
        width,
        height,
        0,
        theme,
        " No changed files",
      );
      expect(result).toMatchSnapshot();
    });
  });

  // ── Added files (status A → toolDiffAdded color) ───────────────────────

  describe("given added files", () => {
    const short = [
      { status: "A" as const, path: "new.ts", insertions: 10, deletions: 0 },
    ];
    const long = [
      {
        status: "A" as const,
        path: "__tests__/extract/__fixtures__/very-long-new-file-name.ts",
        insertions: 42,
        deletions: 0,
      },
    ];

    describe("when unselected and unfocused", () => {
      it("renders short path with file icon after path and status icon at end", () => {
        const result = renderFileChangeRows(short, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long path truncated with icons in correct positions", () => {
        const result = renderFileChangeRows(long, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when selected and focused", () => {
      it("renders short path with selection highlight", () => {
        const result = renderFileChangeRows(short, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long path truncated with selection highlight", () => {
        const result = renderFileChangeRows(long, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });
    });
  });

  // ── Modified files (status M → warning color) ────────────────────────

  describe("given modified files", () => {
    const short = [
      { status: "M" as const, path: "mod.ts", insertions: 5, deletions: 3 },
    ];
    const long = [
      {
        status: "M" as const,
        path: "__tests__/extract/__fixtures__/very-long-modified-file-name.ts",
        insertions: 100,
        deletions: 20,
      },
    ];

    describe("when unselected and unfocused", () => {
      it("renders short path with stats", () => {
        const result = renderFileChangeRows(short, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long path truncated with stats", () => {
        const result = renderFileChangeRows(long, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when selected and focused", () => {
      it("renders short path with selection highlight and stats", () => {
        const result = renderFileChangeRows(short, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long path truncated with selection highlight and stats", () => {
        const result = renderFileChangeRows(long, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });
    });
  });

  // ── Deleted files (status D → toolDiffRemoved color) ──────────────────

  describe("given deleted files", () => {
    const short = [
      { status: "D" as const, path: "gone.ts", insertions: 0, deletions: 15 },
    ];
    const long = [
      {
        status: "D" as const,
        path: "__tests__/extract/__fixtures__/very-long-deleted-file-name.ts",
        insertions: 0,
        deletions: 200,
      },
    ];

    describe("when unselected and unfocused", () => {
      it("renders short deleted file with deletion stats", () => {
        const result = renderFileChangeRows(short, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long deleted file truncated with stats", () => {
        const result = renderFileChangeRows(long, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when selected and focused", () => {
      it("renders short deleted file with selection highlight", () => {
        const result = renderFileChangeRows(short, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long deleted file truncated with selection highlight", () => {
        const result = renderFileChangeRows(long, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });
    });
  });

  // ── Renamed files (status R → warning color) ─────────────────────────

  describe("given renamed files", () => {
    const short = [
      { status: "R" as const, path: "moved.ts", insertions: 0, deletions: 0 },
    ];
    const long = [
      {
        status: "R" as const,
        path: "__tests__/extract/__fixtures__/very-long-renamed-file-name.ts",
        insertions: 0,
        deletions: 0,
      },
    ];

    describe("when unselected and unfocused", () => {
      it("renders short renamed file with zero stats", () => {
        const result = renderFileChangeRows(short, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long renamed file truncated with no stats", () => {
        const result = renderFileChangeRows(long, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when selected and focused", () => {
      it("renders short renamed file with selection highlight", () => {
        const result = renderFileChangeRows(short, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });

      it("renders long renamed file truncated with selection highlight", () => {
        const result = renderFileChangeRows(long, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });
    });
  });

  // ── Exists files (status E → warning color) ──────────────────────────

  describe("given exists files", () => {
    const short = [
      {
        status: "E" as const,
        path: "unchanged.ts",
        insertions: 2,
        deletions: 1,
      },
    ];

    it("renders with small net change stats", () => {
      const result = renderFileChangeRows(short, width, height, 0, theme);
      expect(result).toMatchSnapshot();
    });

    selectedAndFocused(short);
  });

  // ── Unknown status (status ? → warning color) ────────────────────────

  describe("given unknown-status files", () => {
    const short = [
      {
        status: "?" as const,
        path: "weird.json",
        insertions: 10,
        deletions: 0,
      },
    ];

    it("renders with warning color and stats", () => {
      const result = renderFileChangeRows(short, width, height, 0, theme);
      expect(result).toMatchSnapshot();
    });

    selectedAndFocused(short);
  });

  // ── Layout verification: status icon at far right ────────────────────

  describe("given files with various path lengths", () => {
    const files = [
      { status: "M" as const, path: "a.ts", insertions: 1, deletions: 0 },
      {
        status: "R" as const,
        path: "short-path.ts",
        insertions: 0,
        deletions: 0,
      },
      {
        status: "A" as const,
        path: "__tests__/extract/__fixtures__/very-long-file-name-that-needs-truncation.ts",
        insertions: 50,
        deletions: 10,
      },
    ];

    describe("when rendering all three with index -1 (unselected)", () => {
      it("then each row has the layout: fileIcon path... stats statusIcon", () => {
        const result = renderFileChangeRows(files, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering with middle file selected", () => {
      it("then the selected row shows highlight with correct layout", () => {
        const result = renderFileChangeRows(files, width, height, 1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering with truncated path file selected", () => {
      it("then the long path is truncated and icons remain visible at edges", () => {
        const result = renderFileChangeRows(files, width, height, 2, theme);
        expect(result).toMatchSnapshot();
      });
    });
  });

  // ── Stats display: positive vs negative net changes ──────────────────

  describe("given files with different net change directions", () => {
    const files = [
      {
        status: "M" as const,
        path: "mostly-added.ts",
        insertions: 100,
        deletions: 5,
      },
      {
        status: "M" as const,
        path: "mostly-removed.ts",
        insertions: 3,
        deletions: 80,
      },
      {
        status: "M" as const,
        path: "balanced.ts",
        insertions: 50,
        deletions: 49,
      },
    ];

    it("renders with correct signed stats for each file", () => {
      const result = renderFileChangeRows(files, width, height, -1, theme);
      expect(result).toMatchSnapshot();
    });
  });

  // ── Scrolling: visible count smaller than total ───────────────────────

  describe("when terminal height is smaller than file count", () => {
    const statuses = ["A", "M", "D", "R"];
    const files = Array.from({ length: 20 }, (_, i) => ({
      status: statuses[i % 4],
      path: `file-${String(i).padStart(3, "0")}.ts`,
      insertions: (i + 1) * 5,
      deletions: (i + 1) * 2,
    }));

    describe("when scrolled to top (index 0)", () => {
      it("then shows only the first visible rows", () => {
        const result = renderFileChangeRows(files, width, height, 0, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when scrolled to middle (index 9)", () => {
      it("then shows only the visible rows around index 9", () => {
        const result = renderFileChangeRows(files, width, height, 9, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when scrolled to bottom (index 18)", () => {
      it("then shows only the last visible rows", () => {
        const result = renderFileChangeRows(files, width, height, 18, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when scrolled to bottom (index 19)", () => {
      it("then shows the last few rows including the very last one", () => {
        const result = renderFileChangeRows(files, width, height, 19, theme);
        expect(result).toMatchSnapshot();
      });
    });
  });

  // ── Mixed real-world scenario ────────────────────────────────────────

  describe("given a realistic mixed change set", () => {
    const files = [
      {
        status: "A" as const,
        path: "src/new-feature.ts",
        insertions: 120,
        deletions: 0,
      },
      {
        status: "M" as const,
        path: "src/existing.ts",
        insertions: 8,
        deletions: 3,
      },
      {
        status: "R" as const,
        path: "__tests__/extract/__fixtures__/renamed-file.ts",
        insertions: 0,
        deletions: 0,
      },
      {
        status: "D" as const,
        path: "src/old-deprecated.ts",
        insertions: 0,
        deletions: 95,
      },
      {
        status: "M" as const,
        path: "src/utils/helpers.ts",
        insertions: 15,
        deletions: 7,
      },
    ];

    describe("when rendering all unselected", () => {
      it("then shows all five rows with correct per-file formatting", () => {
        const result = renderFileChangeRows(files, width, height, -1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering with second file selected (modified)", () => {
      it("then highlights the modified file and shows all rows", () => {
        const result = renderFileChangeRows(files, width, height, 1, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering with renamed file selected", () => {
      it("then highlights the renamed file with zero stats", () => {
        const result = renderFileChangeRows(files, width, height, 2, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering with deleted file selected", () => {
      it("then highlights the deleted file with red deletion stats", () => {
        const result = renderFileChangeRows(files, width, height, 3, theme);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering with last file selected", () => {
      it("then highlights the last file at bottom of list", () => {
        const result = renderFileChangeRows(files, width, height, 4, theme);
        expect(result).toMatchSnapshot();
      });
    });
  });

  // ── Edge case: zero insertions and deletions (no stats) ──────────────

  describe("given files with no changes at all", () => {
    const files = [
      { status: "E" as const, path: "empty.ts", insertions: 0, deletions: 0 },
      {
        status: "R" as const,
        path: "renamed-empty.ts",
        insertions: 0,
        deletions: 0,
      },
    ];

    it("renders without stats text between path and icons", () => {
      const result = renderFileChangeRows(files, width, height, -1, theme);
      expect(result).toMatchSnapshot();
    });
  });
});

describe("renderFileChangeRows — rendering output stability", () => {
  describe("given identical input repeated calls", () => {
    const files = [
      { status: "A" as const, path: "a.ts", insertions: 10, deletions: 0 },
      { status: "M" as const, path: "b.ts", insertions: 5, deletions: 2 },
    ];

    it("then produces identical output on repeated calls", () => {
      const result1 = renderFileChangeRows(files, width, height, 0, theme);
      const result2 = renderFileChangeRows(files, width, height, 0, theme);
      expect(result1).toEqual(result2);
    });
  });
});
