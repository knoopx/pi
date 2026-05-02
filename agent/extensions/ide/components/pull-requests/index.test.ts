import { describe, it, expect, vi } from "vitest";
import type { KeybindingsManager } from "@mariozechner/pi-coding-agent";
import { createPullRequestsComponent } from "./component";
import {
  createErrorFixture,
  createComponentTest,
  snapshotRender,
} from "../../lib/test-utils";
import type { RawPr } from "./data-fetching";

const REPO = "/tmp/test-project";

function defaultPr(index: number): RawPr {
  const i = index + 1;
  return {
    number: i,
    title: `Pull Request #${i}`,
    state: "OPEN",
    isDraft: false,
    author: { login: "alice" },
    headRefName: `feature/branch-${i}`,
    baseRefName: "main",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-15T12:00:00Z",
    additions: 10,
    deletions: 5,
    reviewDecision: null,
    url: `https://github.com/repo/pull/${i}`,
    body: "",
  };
}

function makePrData(prs: Partial<RawPr>[]): string {
  return JSON.stringify(prs.map((p, i) => ({ ...defaultPr(i), ...p })));
}

async function createFixture(stdout: string) {
  return createComponentTest(
    createPullRequestsComponent as unknown as (
      options: Record<string, unknown>,
    ) => {
      render: (cols: number) => string[];
    },
    {
      stdout,
      keybindings: {} as KeybindingsManager,
      done: vi.fn(),
      cwd: REPO,
    },
  );
}

describe("pull-requests — list row rendering", () => {
  describe("given empty results", () => {
    it("renders the no items message", async () => {
      const { component } = await createFixture("[]");
      snapshotRender(component);
    });
  });

  describe("given a single PR", () => {
    it("renders the PR with state icon and metadata", async () => {
      const { component } = await createFixture(
        makePrData([
          {
            number: 42,
            title: "feat(ide): add split panel preview for file explorer",
            author: { login: "knoopx" },
            headRefName: "feature/split-panel",
            baseRefName: "main",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given multiple PRs", () => {
    it("renders all PRs with consistent padding", async () => {
      const { component } = await createFixture(
        makePrData([
          {
            number: 1,
            title: "feat(ide): integrate pi-tui component architecture",
            state: "OPEN",
            author: { login: "knoopx" },
            headRefName: "feature/pi-tui-integration",
            baseRefName: "main",
          },
          {
            number: 2,
            title: "fix(tui): resolve race condition in list-picker update",
            state: "MERGED",
            author: { login: "knoopx" },
            headRefName: "fix/list-picker-race",
            baseRefName: "main",
          },
          {
            number: 3,
            title: "docs: update README with installation guide",
            state: "CLOSED",
            author: { login: "knoopx" },
            headRefName: "docs/install-guide",
            baseRefName: "main",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });

    it("renders draft PRs with draft indicator", async () => {
      const { component } = await createFixture(
        makePrData([
          {
            number: 1,
            title: "WIP feat(ide): experimental virtual list rendering",
            isDraft: true,
            author: { login: "knoopx" },
            headRefName: "wip/virtual-list",
            baseRefName: "main",
          },
          {
            number: 2,
            title: "feat(ide): add split panel preview for file explorer",
            isDraft: false,
            author: { login: "knoopx" },
            headRefName: "feature/split-panel",
            baseRefName: "main",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });

    it("renders PRs with review decisions", async () => {
      const { component } = await createFixture(
        makePrData([
          {
            number: 1,
            title: "feat(ide): add split panel preview for file explorer",
            reviewDecision: "APPROVED",
            author: { login: "knoopx" },
            headRefName: "feature/split-panel",
            baseRefName: "main",
          },
          {
            number: 2,
            title: "refactor(ide): simplify list-picker component rendering",
            reviewDecision: "CHANGES_REQUESTED",
            author: { login: "knoopx" },
            headRefName: "refactor/list-picker",
            baseRefName: "main",
          },
          {
            number: 3,
            title: "chore: update dependency @mariozechner/pi-tui to ^0.3.0",
            reviewDecision: null,
            author: { login: "knoopx" },
            headRefName: "chore/deps-update",
            baseRefName: "main",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });

    it("renders PRs with large change stats", async () => {
      const { component } = await createFixture(
        makePrData([
          {
            number: 1,
            title: "feat(ide): integrate pi-tui component architecture",
            additions: 1500,
            deletions: 800,
            author: { login: "knoopx" },
            headRefName: "feature/pi-tui-integration",
            baseRefName: "main",
          },
          {
            number: 2,
            title: "fix(tui): resolve typo in split-panel border",
            additions: 3,
            deletions: 1,
            author: { login: "knoopx" },
            headRefName: "fix/border-typo",
            baseRefName: "main",
          },
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a long PR list", () => {
    it("renders scrollable rows with consistent padding", async () => {
      const prs = Array.from({ length: 20 }, (_, i) => ({
        number: i + 1,
        title: [
          `feat(ide): add split panel preview for file explorer`,
          `fix(tui): resolve race condition in list-picker update`,
          `refactor(ide): simplify component rendering pipeline`,
          `chore: bump version to 0.4.0 and update deps`,
          `docs: update README with installation guide`,
          `test(ide): add snapshot tests for all components`,
          `fix(ide): handle empty state in bookmarks view`,
          `feat(ide): add keyboard shortcut for file preview toggle`,
          `perf(ide): optimize file icon resolution performance`,
          `chore(deps): update @mariozechner/pi-tui to ^0.3.0`,
        ][i % 10],
        headRefName: [
          "feature/split-panel",
          "fix/list-picker-race",
          "refactor/rendering-pipeline",
          "release/v0.4.0",
          "docs/install-guide",
          "test/snapshot-tests",
          "fix/bookmarks-empty",
          "feature/file-preview-toggle",
          "perf/file-icons",
          "chore/deps-update",
        ][i % 10],
        author: { login: "knoopx" },
      }));
      const { component } = await createFixture(makePrData(prs));
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a gh command error", () => {
    it("renders error state when gh pr list fails", async () => {
      const result = await createErrorFixture({
        componentFactory: createPullRequestsComponent as unknown as (
          options: Record<string, unknown>,
        ) => {
          render: (cols: number) => string[];
        },
        config: {
          keybindings: {} as KeybindingsManager,
          done: vi.fn(),
          cwd: REPO,
        },
        stderr: "Not a GitHub repository",
      });
      expect(result.join("\n")).toMatchSnapshot();
    });
  });
});
