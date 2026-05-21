import { describe, it, expect } from "vitest";
import defaults from "./uv";
import { commandGroupMatches } from "../test-helpers";

describe("uv", () => {
  it("then blocks python and pip, allows uv", () => {
    expect(commandGroupMatches(defaults, "uv", "python3 script.py")).toBe(true);
    expect(commandGroupMatches(defaults, "uv", "pip install x")).toBe(true);
    expect(commandGroupMatches(defaults, "uv", "uv run script.py")).toBe(false);
  });
});
