import { describe, it, expect, vi } from "vitest";
import type * as fsPromises from "node:fs/promises";

type ImportOriginal = () => Promise<typeof fsPromises>;
vi.mock("node:fs/promises", async (importOriginal: ImportOriginal) => {
  const actual = await importOriginal();
  const { mockReadFileImplementation } = await import("../files/test-helpers");
  return {
    ...actual,
    readFile: vi.fn().mockImplementation(mockReadFileImplementation),
  };
});

import { createBookmarksComponent } from "./component";
import {
  createMockPi,
  createMockTui,
  createMockTheme,
} from "../../lib/test-utils";

const REPO = "/tmp/test-project";

function makeBookmarkOutput(
  entries: {
    bookmark: string;
    changeId: string;
    description?: string;
    author?: string;
  }[],
): string {
  return entries
    .map(
      (e) =>
        `${e.bookmark}\t${e.changeId}\t${e.description ?? ""}\t${e.author ?? ""}`,
    )
    .join("\n");
}

const MOCK_DIFF = `diff --git a/agent/extensions/ide/components/files.ts b/agent/extensions/ide/components/files.ts
index abc1234..def5678 100644
--- a/agent/extensions/ide/components/files.ts
+++ b/agent/extensions/ide/components/files.ts
@@ -1,5 +1,8 @@
 import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
+import type { Theme } from "@mariozechner/pi-coding-agent";
 import { createListPicker } from "../../lib/list-picker";
+import { createFilePreviewLoader } from "../../lib/preview-utils";
 import { getFileIcon } from "../../lib/file-icons";
 `;

async function createFixture(stdout: string) {
  const mockPi = createMockPi({
    exec: vi
      .fn()
      .mockResolvedValue({ code: 0, stdout, stderr: "" })
      .mockImplementation((cmd: string, args?: string[]) => {
        if (cmd === "jj" && args?.includes("diff")) {
          return Promise.resolve({ code: 0, stdout: MOCK_DIFF, stderr: "" });
        }
        return Promise.resolve({ code: 0, stdout, stderr: "" });
      }),
  });
  const tui = createMockTui();
  const theme = createMockTheme();
  const component = createBookmarksComponent({
    pi: mockPi,
    tui,
    theme,
    keybindings: {} as any,
    done: vi.fn(),
    cwd: REPO,
  });

  await new Promise((r) => setTimeout(r, 50));
  return { component, tui };
}

describe("bookmarks — list row rendering", () => {
  describe("given empty results", () => {
    it("renders the no items message", async () => {
      const { component } = await createFixture("");
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a single bookmark", () => {
    it("renders the bookmark with name and description", async () => {
      const { component } = await createFixture(
        makeBookmarkOutput([
          {
            bookmark: "main@origin",
            changeId: "abc123def456",
            description: "feat(ide): add split panel preview for file explorer",
            author: "knoopx",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given multiple bookmarks on different changes", () => {
    it("renders all bookmarks with consistent padding", async () => {
      const { component } = await createFixture(
        makeBookmarkOutput([
          {
            bookmark: "main@origin",
            changeId: "abc123def456",
            description: "feat(ide): add split panel preview for file explorer",
            author: "knoopx",
          },
          {
            bookmark: "develop@origin",
            changeId: "789ghi012jkl",
            description:
              "refactor(ide): simplify list-picker component rendering",
            author: "knoopx",
          },
          {
            bookmark: "release-v0.4.0",
            changeId: "mno345pqr678",
            description: "chore: bump version to 0.4.0 and update deps",
            author: "knoopx",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given multiple bookmarks on the same change", () => {
    it("groups bookmarks by change ID", async () => {
      const { component } = await createFixture(
        makeBookmarkOutput([
          {
            bookmark: "main@origin",
            changeId: "abc123def456",
            description: "feat(ide): add split panel preview for file explorer",
            author: "knoopx",
          },
          {
            bookmark: "feature/split-panel",
            changeId: "abc123def456",
            description: "feat(ide): add split panel preview for file explorer",
            author: "knoopx",
          },
          {
            bookmark: "release-v0.4.0",
            changeId: "mno345pqr678",
            description: "chore: bump version to 0.4.0 and update deps",
            author: "knoopx",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given bookmarks with long descriptions", () => {
    it("truncates descriptions to fit terminal width", async () => {
      const { component } = await createFixture(
        makeBookmarkOutput([
          {
            bookmark: "feature/pi-tui-integration",
            changeId: "abc123def456",
            description:
              "feat(tui): integrate @mariozechner/pi-tui component architecture with virtual list rendering, dynamic keybindings, and theme-aware split panel layouts",
            author: "knoopx",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given bookmarks with no descriptions", () => {
    it("renders (no description) placeholder", async () => {
      const { component } = await createFixture(
        makeBookmarkOutput([
          {
            bookmark: "wip/experiment",
            changeId: "zzz999yyy888",
            description: "",
            author: "knoopx",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a jj command error", () => {
    it("renders empty list when jj bookmark list fails", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "jj: no repository found",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();
      const component = createBookmarksComponent({
        pi: mockPi,
        tui,
        theme,
        keybindings: {} as any,
        done: vi.fn(),
        cwd: REPO,
      });

      await new Promise((r) => setTimeout(r, 50));
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });
});
