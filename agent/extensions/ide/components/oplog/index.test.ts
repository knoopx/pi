import { describe, it, expect, vi } from "vitest";
import { createOpLogComponent } from "./component";
import {
  createMockPi,
  createMockTui,
  createMockTheme,
} from "../../lib/test-utils";

const REPO = "/tmp/test-project";

// jj op log output format: <opId>|<description>\n
function makeOpLogOutput(entries: string[]): string {
  return entries.join("\n");
}

async function createFixture(stdout: string) {
  const mockPi = createMockPi({
    exec: vi.fn().mockResolvedValue({ code: 0, stdout, stderr: "" }),
  });
  const tui = createMockTui();
  const theme = createMockTheme();
  const component = createOpLogComponent({
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

describe("oplog — list row rendering", () => {
  describe("given empty results", () => {
    it("renders the no items message", async () => {
      const { component } = await createFixture("");
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a single operation", () => {
    it("renders the operation with current indicator", async () => {
      const { component } = await createFixture(
        makeOpLogOutput(["a1b2c3d4e5f6|snapshot working copy"]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given multiple operations", () => {
    it("renders all operations with consistent padding", async () => {
      const { component } = await createFixture(
        makeOpLogOutput([
          "a1b2c3d4e5f6|snapshot working copy",
          "b2c3d4e5f6a1|new empty commit",
          "c3d4e5f6a1b2|describe changes feat(ide): add split panel",
          "d4e5f6a1b2c3|squash commits into abc123def456",
          "e5f6a1b2c3d4|restore workspace to main@origin",
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });

    it("renders long descriptions with truncation", async () => {
      const { component } = await createFixture(
        makeOpLogOutput([
          "a1b2c3d4e5f6|squash commits into abc123def4567890abcdef1234567890abcdef",
          "b2c3d4e5f6a1|describe changes feat(ide): integrate pi-tui component architecture with virtual list rendering",
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });

    it("renders pipe characters in descriptions correctly", async () => {
      const { component } = await createFixture(
        makeOpLogOutput([
          "a1b2c3d4e5f6|edit file agent/extensions/ide/components/files.ts | add preview",
          "b2c3d4e5f6a1|snapshot working copy",
        ]),
      );
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a long operation log", () => {
    it("renders scrollable rows with consistent padding", async () => {
      const operations = [
        "snapshot working copy",
        "new empty commit",
        "describe changes feat(ide): add split panel preview",
        "squash commits into abc123def456",
        "restore workspace to main@origin",
        "edit file agent/extensions/ide/components/files.ts",
        "split commit refactor: simplify list-picker",
        "merge feature branch feature/split-panel",
        "squash commits into 789ghi012jkl",
        "amend description fix typo in component name",
        "update dependency @mariozechner/pi-tui to ^0.3.0",
        "fix lint errors in agent/extensions/ide",
        "add unit tests for preview-utils",
        "refactor lib/split-panel rendering logic",
        "optimize file icon resolution performance",
        "bump version to 0.4.0",
        "rollback changes from failed merge",
        "configure GitHub Actions CI pipeline",
        "update README.md with installation guide",
        "add error handling for jj command failures",
        "implement rate limiting for API calls",
        "fix memory leak in WebSocket handler",
        "upgrade bun to latest stable version",
        "migrate test suite to vitest v2",
      ];
      const entries = operations.map((desc, i) => {
        const id = `${String(i).padStart(12, "0")}`;
        return `${id}|${desc}`;
      });
      const { component } = await createFixture(makeOpLogOutput(entries));
      const result = component.render(120);
      expect(result.join("\n")).toMatchSnapshot();
    });
  });

  describe("given a jj command error", () => {
    it("renders empty list when jj op log fails", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "jj: not a repository",
        }),
      });
      const tui = createMockTui();
      const theme = createMockTheme();
      const component = createOpLogComponent({
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
