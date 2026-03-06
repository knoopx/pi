import { describe, it, expect } from "vitest";
import { buildScreenshotScreenArgs, buildScreenshotWindowArgs } from "./args";
import {
  formatWindows,
  formatWorkspaces,
  formatOutputs,
  formatFocusedWindow,
  formatFocusedOutput,
  formatPickedWindow,
  formatPickedColor,
  formatScreenshotDone,
  type NiriWindow,
  type NiriWorkspace,
  type NiriOutput,
} from "./format";

// ── Arg builders ─────────────────────────────────────────

describe("buildScreenshotScreenArgs", () => {
  describe("given no options", () => {
    it("then returns base command", () => {
      expect(buildScreenshotScreenArgs({})).toEqual([
        "action",
        "screenshot-screen",
      ]);
    });
  });

  describe("given path", () => {
    it("then includes --path", () => {
      expect(buildScreenshotScreenArgs({ path: "/tmp/s.png" })).toEqual([
        "action",
        "screenshot-screen",
        "--path",
        "/tmp/s.png",
      ]);
    });
  });

  describe("given writeToDisk false", () => {
    it("then includes --write-to-disk false", () => {
      expect(buildScreenshotScreenArgs({ writeToDisk: false })).toEqual([
        "action",
        "screenshot-screen",
        "--write-to-disk",
        "false",
      ]);
    });
  });

  describe("given showPointer false", () => {
    it("then includes --show-pointer false", () => {
      expect(buildScreenshotScreenArgs({ showPointer: false })).toEqual([
        "action",
        "screenshot-screen",
        "--show-pointer",
        "false",
      ]);
    });
  });

  describe("given all options", () => {
    it("then includes all flags", () => {
      expect(
        buildScreenshotScreenArgs({
          writeToDisk: true,
          showPointer: false,
          path: "/tmp/out.png",
        }),
      ).toEqual([
        "action",
        "screenshot-screen",
        "--write-to-disk",
        "true",
        "--show-pointer",
        "false",
        "--path",
        "/tmp/out.png",
      ]);
    });
  });
});

describe("buildScreenshotWindowArgs", () => {
  describe("given no options", () => {
    it("then returns base command", () => {
      expect(buildScreenshotWindowArgs({})).toEqual([
        "action",
        "screenshot-window",
      ]);
    });
  });

  describe("given window id", () => {
    it("then includes --id", () => {
      expect(buildScreenshotWindowArgs({ id: 42 })).toEqual([
        "action",
        "screenshot-window",
        "--id",
        "42",
      ]);
    });
  });

  describe("given path", () => {
    it("then includes --path", () => {
      expect(buildScreenshotWindowArgs({ path: "/tmp/w.png" })).toEqual([
        "action",
        "screenshot-window",
        "--path",
        "/tmp/w.png",
      ]);
    });
  });

  describe("given writeToDisk false", () => {
    it("then includes --write-to-disk false", () => {
      expect(buildScreenshotWindowArgs({ writeToDisk: false })).toEqual([
        "action",
        "screenshot-window",
        "--write-to-disk",
        "false",
      ]);
    });
  });

  describe("given all options", () => {
    it("then includes all flags", () => {
      expect(
        buildScreenshotWindowArgs({
          id: 7,
          writeToDisk: true,
          path: "/tmp/win.png",
        }),
      ).toEqual([
        "action",
        "screenshot-window",
        "--id",
        "7",
        "--write-to-disk",
        "true",
        "--path",
        "/tmp/win.png",
      ]);
    });
  });
});

// ── Formatters (snapshot) ────────────────────────────────

const sampleWindows: NiriWindow[] = [
  {
    id: 1,
    title: "My Editor",
    app_id: "code",
    workspace_id: 1,
    is_focused: true,
  },
  {
    id: 2,
    title: "Firefox — GitHub",
    app_id: "firefox",
    workspace_id: 1,
    is_floating: true,
  },
  { id: 3, title: "", app_id: "kitty", workspace_id: 2 },
];

const sampleWorkspaces: NiriWorkspace[] = [
  { id: 10, idx: 1, name: "dev", output: "DP-1", is_focused: true },
  { id: 11, idx: 2, name: "web", output: "DP-1", is_active: true },
  { id: 12, idx: 1, output: "HDMI-1" },
];

const sampleOutputs: NiriOutput[] = [
  {
    name: "DP-1",
    make: "LG",
    model: "27GL850",
    current_mode: { width: 2560, height: 1440, refresh_rate: 144000 },
    scale: 1,
    vrr_enabled: true,
  },
  {
    name: "HDMI-1",
    current_mode: { width: 1920, height: 1080 },
    scale: 1,
  },
];

describe("formatWindows", () => {
  it("then matches snapshot", () => {
    expect(formatWindows(sampleWindows)).toMatchSnapshot();
  });

  it("given empty list, then matches snapshot", () => {
    expect(formatWindows([])).toMatchSnapshot();
  });
});

describe("formatWorkspaces", () => {
  it("then matches snapshot", () => {
    expect(formatWorkspaces(sampleWorkspaces)).toMatchSnapshot();
  });
});

describe("formatOutputs", () => {
  it("then matches snapshot", () => {
    expect(formatOutputs(sampleOutputs)).toMatchSnapshot();
  });
});

describe("formatFocusedWindow", () => {
  it("given focused window, then matches snapshot", () => {
    expect(formatFocusedWindow(sampleWindows[0])).toMatchSnapshot();
  });

  it("given null, then returns no focused window", () => {
    expect(formatFocusedWindow(null)).toBe("No focused window");
  });

  it("given floating window without title, then matches snapshot", () => {
    expect(
      formatFocusedWindow({
        id: 99,
        app_id: "mpv",
        title: "",
        is_floating: true,
      }),
    ).toMatchSnapshot();
  });
});

describe("formatFocusedOutput", () => {
  it("given output with full info, then matches snapshot", () => {
    expect(formatFocusedOutput(sampleOutputs[0])).toMatchSnapshot();
  });

  it("given null, then returns no focused output", () => {
    expect(formatFocusedOutput(null)).toBe("No focused output");
  });

  it("given minimal output, then matches snapshot", () => {
    expect(formatFocusedOutput({ name: "VGA-1" })).toMatchSnapshot();
  });
});

describe("formatPickedWindow", () => {
  it("given window, then matches snapshot", () => {
    expect(formatPickedWindow(sampleWindows[1])).toMatchSnapshot();
  });

  it("given null, then returns no window picked", () => {
    expect(formatPickedWindow(null)).toBe("No window picked");
  });
});

describe("formatPickedColor", () => {
  it("given color string, then returns picked color", () => {
    expect(formatPickedColor("#ff5500")).toBe("Picked color • #ff5500");
  });

  it("given null, then returns no color picked", () => {
    expect(formatPickedColor(null)).toBe("No color picked");
  });
});

describe("formatScreenshotDone", () => {
  it("given path, then returns saved message", () => {
    expect(formatScreenshotDone("/tmp/screenshot.png")).toBe(
      "Screenshot saved • /tmp/screenshot.png",
    );
  });

  it("given no path, then returns taken message", () => {
    expect(formatScreenshotDone()).toBe("Screenshot taken");
  });
});
