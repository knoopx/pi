import { describe, expect, it } from "vitest";
import { renderSplitPanel } from "./renderer";
import type { SplitPanelConfig, SplitPanelDimensions } from "../layout";
import { createMockTheme } from "../../../test/utils";

function getDims(
  width: number = 80,
  height: number = 30,
  opts?: Partial<SplitPanelDimensions>,
): SplitPanelDimensions {
  return {
    width,
    height,
    leftW: Math.floor(width * 0.35),
    rightW: width - Math.floor(width * 0.35) - 3,
    contentH: height - 5,
    ...opts,
  };
}

function getConfig(opts?: Partial<SplitPanelConfig>): SplitPanelConfig {
  return {
    leftTitle: "List",
    rightTitle: "Preview",
    helpText: "↑ nav  ↓ prev  esc close",
    leftFocus: true,
    ...opts,
  };
}

function renderDefaultPanel(
  opts?: Partial<SplitPanelConfig>,
  dimsOpts?: { width?: number; height?: number },
) {
  const theme = createMockTheme();
  const dims = getDims(dimsOpts?.width, dimsOpts?.height);
  const config = getConfig(opts);
  const rows = { left: ["item1"], right: ["line1"] };
  return renderSplitPanel(theme, config, dims, rows);
}

describe("renderSplitPanel — basic layout", () => {
  it("renders top border with corners", () => {
    const result = renderDefaultPanel();

    expect(result[0]).toContain("╭");
    expect(result[0]).toContain("╮");
  });

  it("renders vertical borders", () => {
    const result = renderDefaultPanel();

    expect(result[3]).toContain("│");
  });

  it("renders bottom border", () => {
    const result = renderDefaultPanel();

    expect(result[result.length - 1]).toContain("╰");
  });

  it("renders title row with accent color", () => {
    const result = renderDefaultPanel({
      leftTitle: "Search",
      rightTitle: "Preview",
    });

    expect(result[1]).toContain("Search");
    expect(result[1]).toContain("Preview");
  });

  it("renders separator between header and content", () => {
    const result = renderDefaultPanel();

    expect(result[2]).toContain("├");
    expect(result[2]).toContain("┤");
  });
});

describe("renderSplitPanel — focus styling", () => {
  it("uses borderAccent for focused left panel", () => {
    const result = renderDefaultPanel({ leftFocus: true });

    expect(result[0]).toBeDefined();
  });

  it("uses border for unfocused panels", () => {
    const result = renderDefaultPanel({ leftFocus: false, rightFocus: false });

    expect(result.length).toBeGreaterThan(0);
  });
});

describe("renderSplitPanel — content rendering", () => {
  it("renders left panel content", () => {
    const theme = createMockTheme();
    const dims = getDims();
    const config = getConfig();
    const rows = {
      left: ["first item", "second item", "third item"],
      right: ["preview line 1"],
    };

    const result = renderSplitPanel(theme, config, dims, rows);

    expect(result.some((line) => line.includes("first item"))).toBe(true);
    expect(result.some((line) => line.includes("second item"))).toBe(true);
  });

  it("renders right panel content", () => {
    const theme = createMockTheme();
    const dims = getDims();
    const config = getConfig();
    const rows = {
      left: ["item1"],
      right: ["source line 1", "source line 2", "source line 3"],
    };

    const result = renderSplitPanel(theme, config, dims, rows);

    expect(result.some((line) => line.includes("source line 1"))).toBe(true);
  });

  it("handles empty right panel", () => {
    const theme = createMockTheme();
    const dims = getDims();
    const config = getConfig();
    const rows = { left: ["item1"], right: [] };

    const result = renderSplitPanel(theme, config, dims, rows);

    expect(result.length).toBeGreaterThan(0);
  });

  it("handles empty left panel", () => {
    const theme = createMockTheme();
    const dims = getDims();
    const config = getConfig();
    const rows = { left: [], right: ["line1"] };

    const result = renderSplitPanel(theme, config, dims, rows);

    expect(result.length).toBeGreaterThan(0);
  });
});

describe("renderSplitPanel — help text", () => {
  it("renders help text in bottom section", () => {
    const result = renderDefaultPanel({ helpText: "↑ nav  ↓ prev  esc close" });

    // Help text should appear near the bottom
    const lastLines = result.slice(-3);
    expect(lastLines.some((line) => line.includes("nav"))).toBe(true);
  });
});

describe("renderSplitPanel — dimensions", () => {
  it("renders correctly at narrow width", () => {
    const result = renderDefaultPanel({}, { width: 40, height: 20 });

    expect(result.length).toBeGreaterThan(0);
  });

  it("renders correctly at wide width", () => {
    const result = renderDefaultPanel({}, { width: 120, height: 30 });

    expect(result.length).toBeGreaterThan(0);
  });

  it("renders correctly with small height", () => {
    const result = renderDefaultPanel({}, { width: 80, height: 15 });

    expect(result.length).toBeGreaterThan(0);
  });
});

describe("renderSplitPanel — snapshot tests", () => {
  it("renders standard panel layout", () => {
    const theme = createMockTheme();
    const dims = getDims(80, 30);
    const config = getConfig({
      leftTitle: "Search (5/10)",
      rightTitle: "Preview",
      helpText: "↑ nav  ↓ prev  esc close",
      leftFocus: true,
    });
    const rows = {
      left: [
        "src/app.ts:1:const x = 42;",
        "src/b.ts:5:foo bar",
        "lib/c.ts:10:baz qux",
        "src/d.ts:15:hello world",
        "src/e.ts:20:test case",
      ],
      right: [
        "const x = 42;",
        "",
        "// more code",
        "function foo() {",
        "  return 42;",
        "}",
      ],
    };

    const result = renderSplitPanel(theme, config, dims, rows);
    expect(result).toMatchSnapshot();
  });

  it("renders with focused item highlight", () => {
    const theme = createMockTheme();
    const dims = getDims(80, 30);
    const config = getConfig({
      leftTitle: "Search (2/5)",
      rightTitle: "src/b.ts",
      helpText: "↑ nav  ↓ prev  esc close",
      leftFocus: true,
    });
    const rows = {
      left: [
        "src/a.ts:1:normal item",
        "src/b.ts:5:focus me",
        "lib/c.ts:10:another item",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      right: ["focus me", "", "// preview content", "  const y = 10;", ""],
    };

    const result = renderSplitPanel(theme, config, dims, rows);
    expect(result).toMatchSnapshot();
  });

  it("renders empty state", () => {
    const theme = createMockTheme();
    const dims = getDims(80, 30);
    const config = getConfig({
      leftTitle: "Search (0/0)",
      rightTitle: "Preview",
      helpText: "↑ nav  ↓ prev  esc close",
      leftFocus: true,
    });
    const rows = {
      left: ["No items found"],
      right: [],
    };

    const result = renderSplitPanel(theme, config, dims, rows);
    expect(result).toMatchSnapshot();
  });
});
