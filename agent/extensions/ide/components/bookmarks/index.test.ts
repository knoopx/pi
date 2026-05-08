import "../test-setup";

import { describe, it, expect, vi } from "vitest";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { createBookmarksComponent } from "./component";
import {
  createErrorFixture,
  createComponentTest,
  snapshotRender,
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
 import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
+import type { Theme } from "@earendil-works/pi-coding-agent";
 import { createListPicker } from "../../lib/list-picker";
+import { createFilePreviewLoader } from "../../lib/preview-utils";
 import { getFileIcon } from "../../lib/file-icons";
 `;

async function createFixture(stdout: string) {
  return createComponentTest(
    createBookmarksComponent as unknown as (
      options: Record<string, unknown>,
    ) => {
      render: (cols: number) => string[];
    },
    {
      stdout,
      keybindings: {} as KeybindingsManager,
      done: vi.fn(),
      cwd: REPO,
      execRouter: (cmd: string, args?: string[]) => {
        if (cmd === "jj" && args?.includes("diff")) {
          return Promise.resolve({ code: 0, stdout: MOCK_DIFF, stderr: "" });
        }
        return Promise.resolve({ code: 0, stdout, stderr: "" });
      },
    },
  );
}

async function renderBookmarks(
  entries: {
    bookmark: string;
    changeId: string;
    description?: string;
    author?: string;
  }[],
) {
  const { component } = await createFixture(makeBookmarkOutput(entries));
  return component.render(120);
}

describe("bookmarks — list row rendering", () => {
  describe("given empty results", () => {
    it("renders the no items message", async () => {
      const { component } = await createFixture("");
      snapshotRender(component);
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
      const result = await renderBookmarks([
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
      ]);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given multiple bookmarks on the same change", () => {
    it("groups bookmarks by change ID", async () => {
      const result = await renderBookmarks([
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
      ]);
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
              "feat(tui): integrate @earendil-works/pi-tui component architecture with virtual list rendering, dynamic keybindings, and theme-aware split panel layouts",
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
      const result = await createErrorFixture({
        componentFactory: createBookmarksComponent as unknown as (
          options: Record<string, unknown>,
        ) => {
          render: (cols: number) => string[];
        },
        config: {
          keybindings: {} as KeybindingsManager,
          done: vi.fn(),
          cwd: REPO,
        },
        stderr: "jj: no repository found",
      });
      expect(result.join("\n")).toMatchSnapshot();
    });
  });
});
