import { describe, it, expect, vi } from "vitest";
import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { createListPicker } from "./list-picker";
import type { ListPickerItem } from "./list-picker";

function createMockTheme(): Theme {
  const fg = (color: string, text: string) => `[${color}:${text}]`;
  return {
    fg,
    bg: (c: string, t: string) => `[BG:${c}:${t}]`,
    bold: (t: string) => `**${t}**`,
  } as unknown as Theme;
}

const theme = createMockTheme();

function createMockTui(rows = 30) {
  return {
    terminal: { rows },
    requestRender: vi.fn(),
  };
}

function createBaseConfig<T extends ListPickerItem>(overrides?: Partial<any>) {
  return {
    title: "Test Picker",
    loadItems: vi.fn().mockResolvedValue([] as T[]),
    filterItems: (items: T[]) => items,
    formatItem: (item: T) => item.label,
    loadPreview: vi.fn().mockResolvedValue([] as string[]),
    actions: [],
    reloadDebounceMs: 0,
    ...overrides,
  };
}

async function setup(items: ListPickerItem[], overrides?: any) {
  const tui = createMockTui();
  const config = createBaseConfig<ListPickerItem>({
    loadItems: vi.fn().mockResolvedValue(items),
    formatItem: (item: ListPickerItem) => `[icon] ${item.label}`,
    filterItems: (items: ListPickerItem[]) => items,
    loadPreview: vi.fn().mockResolvedValue(["line1", "line2"]),
    ...overrides,
  });

  const picker = createListPicker(
    {} as ExtensionAPI,
    tui,
    theme,
    {} as KeybindingsManager,
    () => {},
    "",
    config,
  );

  // Wait for async loading to complete
  await waitForLoaded(picker);

  return { picker, tui };
}

async function createPickerWithConfig(
  tui: ReturnType<typeof createMockTui>,
  overrides: Partial<any>,
) {
  const config = createBaseConfig<ListPickerItem>(overrides);
  const picker = createListPicker(
    {} as ExtensionAPI,
    tui,
    theme,
    {} as KeybindingsManager,
    () => {},
    "",
    config,
  );
  await waitForLoaded(picker);
  return { picker, tui };
}

async function waitForLoaded(picker: any) {
  await vi.waitFor(() => {
    const lines = picker.render(80);
    return !lines.some((l: string) => l.includes("Loading"));
  });
}

describe("list-picker — list row rendering", () => {
  describe("given empty items", () => {
    it("renders the empty message row", async () => {
      const { picker } = await createPickerWithConfig(createMockTui(), {
        loadItems: vi.fn().mockResolvedValue([]),
      });

      const result = picker.render(80);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given loading state", () => {
    it("renders the loading row", async () => {
      const tui = createMockTui();
      const config = createBaseConfig({
        loadItems: vi.fn().mockReturnValue(new Promise(() => {})),
      });

      const picker = createListPicker(
        {} as ExtensionAPI,
        tui,
        theme,
        {} as KeybindingsManager,
        () => {},
        "",
        config,
      );

      const result = picker.render(80);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given error state", () => {
    it("renders the error row", async () => {
      const tui = createMockTui();
      const config = createBaseConfig({
        loadItems: vi.fn().mockRejectedValue(new Error("Failed to load")),
      });

      const picker = createListPicker(
        {} as ExtensionAPI,
        tui,
        theme,
        {} as KeybindingsManager,
        () => {},
        "",
        config,
      );

      // Wait for error state
      await vi.waitFor(
        () => {
          const lines = picker.render(80);
          return !lines.some((l: string) => l.includes("Loading"));
        },
        { timeout: 100 },
      );

      const result = picker.render(80);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given a list of items", () => {
    describe("when rendering with a single item", () => {
      it("renders the item row consistently padded", async () => {
        const { picker } = await setup([{ id: "a", label: "single-file.txt" }]);

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering multiple items with different path lengths", () => {
      it("renders all rows with consistent left padding", async () => {
        const { picker } = await setup([
          { id: "a", label: "short.ts" },
          { id: "b", label: "medium-length-file.ts" },
          {
            id: "c",
            label: "this-is-a-very-long-file-name-that-needs-truncation.ts",
          },
        ]);

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when an item is focused (selected)", () => {
      it("renders focused row with selection highlight", async () => {
        const items = [
          { id: "a", label: "file-a.ts" },
          { id: "b", label: "file-b.ts" },
          { id: "c", label: "file-c.ts" },
        ];

        const { picker, tui } = await setup(items);

        // Focus second item
        (picker as any).focusedIndex = 1;
        (picker as any).invalidate();
        tui.requestRender();

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when the focused item changes", () => {
      it("updates the focused row highlight", async () => {
        const items = [
          { id: "a", label: "alpha.ts" },
          { id: "b", label: "beta.ts" },
          { id: "c", label: "gamma.ts" },
          { id: "d", label: "delta.ts" },
        ];

        const { picker, tui } = await setup(items);

        // Focus last item
        (picker as any).focusedIndex = 3;
        (picker as any).invalidate();
        tui.requestRender();

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when rendering with custom formatItem", () => {
      it("uses the custom formatter consistently across rows", async () => {
        const items = [
          { id: "a", label: "added-file.ts" },
          { id: "b", label: "modified-file.ts" },
          { id: "c", label: "deleted-file.ts" },
        ];

        const { picker } = await createPickerWithConfig(createMockTui(), {
          loadItems: vi.fn().mockResolvedValue(items),
          filterItems: (items: ListPickerItem[]) => items,
          formatItem: (item: ListPickerItem) => `[★] ${item.label}`,
          loadPreview: vi.fn().mockResolvedValue([]),
        });

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when terminal height is smaller than item count", () => {
      it("renders only visible rows with consistent padding", async () => {
        const items = Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          label: `file-${String(i).padStart(3, "0")}.ts`,
        }));

        const { picker } = await setup(items);

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when focused item is near the bottom", () => {
      it("scrolls the list to show the focused item", async () => {
        const items = Array.from({ length: 15 }, (_, i) => ({
          id: String(i),
          label: `long-file-name-${String(i).padStart(3, "0")}.ts`,
        }));

        const { picker, tui } = await createPickerWithConfig(createMockTui(), {
          loadItems: vi.fn().mockResolvedValue(items),
          filterItems: (items: ListPickerItem[]) => items,
          formatItem: (item: ListPickerItem) => `[★] ${item.label}`,
          loadPreview: vi.fn().mockResolvedValue([]),
        });

        // Focus item at index 12
        (picker as any).focusedIndex = 12;
        (picker as any).invalidate();
        tui.requestRender();

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("with wide characters in labels", () => {
      it("renders rows with consistent padding despite wide chars", async () => {
        const { picker } = await setup([
          { id: "a", label: "文件.ts" },
          { id: "b", label: "αρχείο.ts" },
          { id: "c", label: "ファイル.ts" },
        ]);

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("with ANSI-colored labels", () => {
      it("renders rows with consistent padding when formatItem uses theme colors", async () => {
        const items = [
          { id: "a", label: "normal.ts" },
          { id: "b", label: "typescript.ts" },
        ];

        const tui = createMockTui();
        const config = createBaseConfig<ListPickerItem>({
          loadItems: vi.fn().mockResolvedValue(items),
          filterItems: (items: ListPickerItem[]) => items,
          formatItem: (item: ListPickerItem, _w: number, th: Theme) =>
            th.fg("accent", `[icon] ${item.label}`),
          loadPreview: vi.fn().mockResolvedValue([]),
        });

        const picker = createListPicker(
          {} as ExtensionAPI,
          tui,
          theme,
          {} as KeybindingsManager,
          () => {},
          "",
          config,
        );

        await waitForLoaded(picker);

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe("when rendered at different widths", () => {
    it("produces consistent padding at narrow width", async () => {
      const items = [
        { id: "a", label: "short.ts" },
        { id: "b", label: "a-very-long-file-name-here.ts" },
      ];

      const { picker } = await setup(items);

      const result = picker.render(40);
      expect(result).toMatchSnapshot();
    });

    it("produces consistent padding at wide width", async () => {
      const items = [
        { id: "a", label: "short.ts" },
        { id: "b", label: "medium-file.ts" },
      ];

      const { picker } = await setup(items);

      const result = picker.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("rendering output stability", () => {
    it("produces identical output on repeated renders with same state", async () => {
      const items = [
        { id: "a", label: "file-a.ts" },
        { id: "b", label: "file-b.ts" },
      ];

      const { picker } = await setup(items);

      // Focus second item
      (picker as any).focusedIndex = 1;
      (picker as any).invalidate();

      const result1 = picker.render(80);
      const result2 = picker.render(80);

      expect(result1).toEqual(result2);
    });
  });
});
