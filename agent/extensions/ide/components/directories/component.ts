import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { Key, type Component } from "@earendil-works/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
} from "../../lib/list-picker/picker";
import {
  dirIconGlyph,
  getFileIcon,
  getFileIconColor,
} from "../../lib/file-icons";
import { hexColor } from "../../lib/split-panel/text-transforms";
import type { DirectoryInfo } from "./types";

interface DirectoriesComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: DirectoryInfo | null) => void;
  initialQuery: string;
  ctx: ExtensionContext;
}

export function createDirectoriesComponent(
  options: DirectoriesComponentOptions,
): ListPickerComponent & Component {
  return new DirectoriesView(options);
}

class DirectoriesView implements Component {
  private picker: ListPickerComponent;

  constructor(private options: DirectoriesComponentOptions) {
    const { pi, tui, theme, keybindings, initialQuery, ctx } = this.options;

    this.picker = createListPicker<DirectoryInfo>({
      pi,
      tui,
      theme,
      keybindings,
      done: (item) => {
        this.options.done(item);
      },
      initialQuery,
      config: {
        title: () => "Directories",
        formatItem: (item) => {
          const icon = dirIconGlyph();
          const hex = getFileIconColor(item.path + "/");
          const colored =
            hex !== null && /^#[0-9a-f]{6}$/i.test(hex)
              ? hexColor(hex, icon)
              : icon;
          return `${colored}${item.path}`;
        },
        async loadPreview(item) {
          const dir = item.path === "." ? ctx.cwd : join(ctx.cwd, item.path);
          try {
            const result = await pi.exec("ls", ["-1p", dir], { cwd: ctx.cwd });
            if (result.code !== 0) return [];

            return result.stdout
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .sort((a, b) => {
                const aIsDir = a.endsWith("/");
                const bIsDir = b.endsWith("/");
                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.localeCompare(b);
              })
              .map((entry) => {
                if (entry.endsWith("/")) {
                  const icon = dirIconGlyph();
                  const hex = getFileIconColor(entry);
                  const colored =
                    hex !== null && /^#[0-9a-f]{6}$/i.test(hex)
                      ? hexColor(hex, icon)
                      : icon;
                  return `${colored}${entry}`;
                }
                const icon = getFileIcon(entry);
                const hex = getFileIconColor(entry);
                const colored =
                  hex !== null && /^#[0-9a-f]{6}$/i.test(hex)
                    ? hexColor(hex, icon)
                    : icon;
                return `${colored} ${entry}`;
              });
          } catch {
            return [];
          }
        },
        filterItems: (items, query) =>
          items.filter((item) => item.path.toLowerCase().includes(query)),
        async loadItems(_query: string) {
          const result = await pi.exec(
            "rg",
            ["--files", "--hidden", "-g", "!node_modules", "-g", "!.git"],
            { cwd: ctx.cwd },
          );
          if (result.code !== 0)
            throw new Error(`Failed to load files: ${result.stderr}`);

          const dirs = new Set<string>();
          for (const line of result.stdout.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const dir = trimmed.includes("/")
              ? trimmed.substring(0, trimmed.lastIndexOf("/"))
              : ".";
            dirs.add(dir);
          }

          return Array.from(dirs)
            .filter((d) => d !== ".")
            .sort()
            .map((path) => ({ id: path, label: path, path }));
        },
        actions: [
          {
            key: Key.ctrl("i"),
            label: "cd",
            handler: (item) => {
              this.options.done(item);
            },
          },
        ],
      },
    });
  }

  render(width: number): string[] {
    return this.picker.render(width);
  }

  handleInput(data: string): void {
    this.picker.handleInput(data);
  }

  invalidate(): void {
    this.picker.invalidate();
  }

  setPreview(_lines: string[]): void {}

  reload(): Promise<void> {
    this.invalidate();
    return Promise.resolve();
  }

  dispose(): void {
    this.picker.dispose();
  }
}
