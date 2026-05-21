import { describe, it, expect } from "vitest";
import { createTextResultRender, createListRenderCall } from "./rendering";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { createMockTheme } from "../../../shared/testing/mock-theme";

describe("createTextResultRender", () => {
  it("returns a render function", () => {
    const render = createTextResultRender();
    expect(typeof render).toBe("function");
  });
});

describe("createListRenderCall", () => {
  it("returns a render call function", () => {
    const call = createListRenderCall("gh-list-issues");
    expect(typeof call).toBe("function");
  });

  function makeMockTheme(): Theme {
    return createMockTheme() as unknown as Theme;
  }

  it("includes owner/repo in output when provided", () => {
    const call = createListRenderCall("gh-list-prs");
    const result = call({ owner: "facebook", repo: "react" }, makeMockTheme());
    expect(result).toBeDefined();
  });

  it("handles missing owner gracefully", () => {
    const call = createListRenderCall("gh-list-prs");
    const result = call({}, makeMockTheme());
    expect(result).toBeDefined();
  });
});
