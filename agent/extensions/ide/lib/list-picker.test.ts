import { describe, it, expect, vi } from "vitest";
import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { createListPicker } from "./list-picker";
import type { ListPickerItem } from "./list-picker";
import { createMockTheme } from "./test-utils";

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

async function waitForLoaded(picker: any) {
  await vi.waitFor(() => {
    const lines = picker.render(80);
    return !lines.some((l: string) => l.includes("Loading"));
  });
}

async function createPicker(configOverrides: Partial<any>) {
  const tui = createMockTui();
  const config = createBaseConfig<ListPickerItem>(configOverrides);
  const picker = createListPicker({
    pi: {} as ExtensionAPI,
    tui,
    theme,
    keybindings: {} as KeybindingsManager,
    done: () => {},
    initialQuery: "",
    config,
  });
  await waitForLoaded(picker);
  return { picker, tui };
}

function setup(
  items: ListPickerItem[],
  overrides?: Record<string, unknown>,
): ReturnType<typeof createPicker> {
  return createPicker({
    loadItems: vi.fn().mockResolvedValue(items),
    formatItem: (item: ListPickerItem) => `[icon] ${item.label}`,
    filterItems: (items: ListPickerItem[]) => items,
    loadPreview: vi.fn().mockResolvedValue(["line1", "line2"]),
    ...overrides,
  });
}

function focusItem(picker: any, tui: any, index: number) {
  picker.focusedIndex = index;
  picker.invalidate();
  tui.requestRender();
}

function createItems(count: number, labelPrefix: string): ListPickerItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    label: `${labelPrefix}${String(i).padStart(3, "0")}.ts`,
  }));
}

describe("list-picker — list row rendering", () => {
  describe("given empty items", () => {
    it("renders the empty message row", async () => {
      const { picker } = await createPicker({
        loadItems: vi.fn().mockResolvedValue([]),
      });

      const result = picker.render(80);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given loading state", () => {
    it("renders the loading row", async () => {
      const { picker } = await createPicker({
        loadItems: vi.fn().mockReturnValue(new Promise(() => {})),
      });

      const result = picker.render(80);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given error state", () => {
    it("renders the error row", async () => {
      // Wait for error state before rendering
      const { picker } = await createPicker({
        loadItems: vi.fn().mockRejectedValue(new Error("Failed to load")),
      });

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
        focusItem(picker, tui, 1);

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
        focusItem(picker, tui, 3);

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

        const { picker } = await setup(items, {
          formatItem: (item: ListPickerItem) => `[★] ${item.label}`,
          loadPreview: vi.fn().mockResolvedValue([]),
        });

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when terminal height is smaller than item count", () => {
      it("renders only visible rows with consistent padding", async () => {
        const { picker } = await setup(createItems(15, "file-"));

        const result = picker.render(80);
        expect(result).toMatchSnapshot();
      });
    });

    describe("when focused item is near the bottom", () => {
      it("scrolls the list to show the focused item", async () => {
        const { picker, tui } = await setup(
          createItems(15, "long-file-name-"),
          {
            formatItem: (item: ListPickerItem) => `[★] ${item.label}`,
            loadPreview: vi.fn().mockResolvedValue([]),
          },
        );

        // Focus item at index 12
        focusItem(picker, tui, 12);

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

        const { picker } = await createPicker({
          loadItems: vi.fn().mockResolvedValue(items),
          filterItems: (items: ListPickerItem[]) => items,
          formatItem: (item: ListPickerItem, _w: number, th: Theme) =>
            th.fg("accent", `[icon] ${item.label}`),
          loadPreview: vi.fn().mockResolvedValue([]),
        });

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

      const { picker, tui } = await setup(items);

      // Focus second item
      focusItem(picker, tui, 1);

      const result1 = picker.render(80);
      const result2 = picker.render(80);

      expect(result1).toEqual(result2);
    });
  });
});

describe("list-picker — onKey reload callback", () => {
  it("passes a reload function as the second argument to onKey", async () => {
    const onKey = vi.fn((data, onReload) => {
      expect(typeof onReload).toBe("function");
      return false;
    });

    const { picker } = await createPicker({
      loadItems: vi.fn().mockResolvedValue([{ id: "a", label: "test.ts" }]),
      onKey,
    });

    // Simulate a key press that onKey handles
    picker.handleInput("x");

    expect(onKey).toHaveBeenCalledWith("x", expect.any(Function));
  });

  it("calling the reload callback triggers loadItems to refetch data", async () => {
    const loadItemsMock = vi.fn();
    loadItemsMock.mockResolvedValueOnce([{ id: "a", label: "v1.ts" }]);

    let capturedReload: (() => void) | undefined;

    const { picker } = await createPicker({
      loadItems: loadItemsMock,
      onKey: (_data: string, onReload?: () => void) => {
        capturedReload = onReload;
        return true;
      },
    });

    expect(loadItemsMock).toHaveBeenCalledTimes(1);

    // Simulate a key press to capture the reload callback
    picker.handleInput("x");

    // Prepare next load result
    loadItemsMock.mockResolvedValueOnce([{ id: "b", label: "v2.ts" }]);

    // Trigger reload via captured callback
    capturedReload?.();

    // Wait for reload to complete
    await vi.waitFor(() => {
      expect(loadItemsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("onKey returning false falls through to default key handling", async () => {
    const onKey = vi.fn(() => false);

    const { picker } = await createPicker({
      loadItems: vi.fn().mockResolvedValue([
        { id: "a", label: "file-a.ts" },
        { id: "b", label: "file-b.ts" },
      ]),
      onKey,
    });

    // Type a character — onKey returns false, so default handler adds it to search
    picker.handleInput("f");

    expect(onKey).toHaveBeenCalledWith("f", expect.any(Function));
    // Default handler should have processed the input too (search query updated)
    const lines = picker.render(80);
    // Should show filtered results (items containing 'f')
    expect(lines.some((l: string) => l.includes("file-"))).toBe(true);
  });
});
