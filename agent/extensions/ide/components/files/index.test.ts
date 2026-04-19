import { describe, it, expect, vi } from "vitest";
import type * as fsPromises from "node:fs/promises";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  const { mockReadFileImplementation } = await import("./test-helpers");
  return {
    ...actual,
    readFile: vi.fn().mockImplementation(mockReadFileImplementation),
  };
});

import type { TestTerminal } from "../../lib/test-utils";
import { createMockPi } from "../../lib/test-utils";
import { createFilesFixture, makeFilesMockPi } from "./test-helpers";

describe("files — list row rendering", () => {
  describe("given a list of files", () => {
    it("renders file rows with consistent padding across different path lengths", async () => {
      const { component } = await createFilesFixture(makeFilesMockPi());

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders rows with leading space before file icons", async () => {
      const { component } = await createFilesFixture(
        makeFilesMockPi(
          "a.ts\nagent/extensions/ide/components/list-picker.test.ts\nagent/extensions/nix/nix.test.ts\n",
        ),
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders file rows with mixed extensions and consistent left alignment", async () => {
      const { component } = await createFilesFixture(
        makeFilesMockPi(
          [
            "src/index.ts",
            "src/utils/helper.ts",
            "README.md",
            "package.json",
            "flake.nix",
            "__tests__/test.test.ts",
          ].join("\n"),
        ),
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given a long file list", () => {
    it("renders scrollable rows with consistent padding for all visible items", async () => {
      const files = [
        "agent/extensions/ide/components/files.ts",
        "agent/extensions/ide/components/list-picker.ts",
        "agent/extensions/ide/components/split-panel/border.ts",
        "agent/extensions/nix/nix.test.ts",
        "agent/extensions/gh/index.ts",
        "agent/shared/tool-utils.ts",
        "agent/extensions/usage/usage.test.ts",
        "flake.nix",
        "package.json",
        "README.md",
        "src/main.rs",
        "src/lib.go",
        "__snapshots__/files.test.ts.snap",
        "__tests__/test.test.ts",
        ".gitignore",
      ].join("\n");

      const { component } = await createFilesFixture(makeFilesMockPi(files));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("maintains consistent row padding when terminal height is smaller than file count", async () => {
      const files = Array.from(
        { length: 30 },
        (_, i) =>
          `agent/extensions/ide/components/file-${String(i).padStart(3, "0")}.ts`,
      ).join("\n");

      const { component, tui } = await createFilesFixture(
        makeFilesMockPi(files),
      );
      (tui.terminal as TestTerminal).columns = 80;
      (tui.terminal as TestTerminal).rows = 15;

      const result = component.render(80);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given files with different icon types", () => {
    it("renders rows consistently for TypeScript files", async () => {
      const { component } = await createFilesFixture(
        makeFilesMockPi("index.ts\napp.tsx\nconfig.mts\nutils.cts\n"),
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders rows consistently for YAML/Nix files", async () => {
      const { component } = await createFilesFixture(
        makeFilesMockPi("flake.nix\ndocker-compose.yml\nconfig.yaml\n.env\n"),
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });

    it("renders rows consistently for various file types in mixed list", async () => {
      const { component } = await createFilesFixture(
        makeFilesMockPi(
          [
            "src/main.ts",
            "flake.lock",
            "package.json",
            "Dockerfile",
            "Makefile",
            ".gitignore",
            "README.md",
            "Cargo.toml",
            "go.mod",
            "requirements.txt",
          ].join("\n"),
        ),
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given an empty file list", () => {
    it("renders the no items message with consistent padding", async () => {
      const { component } = await createFilesFixture(makeFilesMockPi(""));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given a file load error", () => {
    it("renders the error message with consistent padding", async () => {
      const mockPi = createMockPi({
        exec: vi.fn().mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "rg: command not found",
        }),
      });

      const { component } = await createFilesFixture(mockPi);

      await new Promise((r) => setTimeout(r, 50));

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given a search query filter", () => {
    it("renders filtered results with consistent padding", async () => {
      const { component } = await createFilesFixture(
        makeFilesMockPi(
          [
            "agent.ts",
            "agent/index.ts",
            "config.yaml",
            "README.md",
            "agent/test.ts",
          ].join("\n"),
        ),
        "agent",
      );

      const result = component.render(120);
      expect(result).toMatchSnapshot();
    });
  });

  describe("given different terminal widths", () => {
    it("renders with consistent padding at narrow width", async () => {
      const { component, tui } = await createFilesFixture(
        makeFilesMockPi("a.ts\nlong-file-name-here.ts\nc.ts\n"),
      );
      (tui.terminal as TestTerminal).columns = 60;

      const result = component.render(60);
      expect(result).toMatchSnapshot();
    });

    it("renders with consistent padding at wide width", async () => {
      const { component, tui } = await createFilesFixture(
        makeFilesMockPi("a.ts\nb.ts\nc.ts\n"),
      );
      (tui.terminal as TestTerminal).columns = 160;

      const result = component.render(160);
      expect(result).toMatchSnapshot();
    });
  });

  describe("rendering output stability", () => {
    it("produces identical output on repeated renders with same state", async () => {
      const { component } = await createFilesFixture(
        makeFilesMockPi("file-a.ts\nfile-b.ts\nfile-c.ts\n"),
      );

      const result1 = component.render(120);
      const result2 = component.render(120);

      expect(result1).toEqual(result2);
    });
  });
});
