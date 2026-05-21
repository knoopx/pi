import { describe, it, expect } from "vitest";
import defaults from "./podman";
import { commandGroupMatches } from "../test-helpers";

describe("podman", () => {
  it("then blocks docker, allows podman", () => {
    expect(commandGroupMatches(defaults, "podman", "docker run nginx")).toBe(
      true,
    );
    expect(commandGroupMatches(defaults, "podman", "docker-compose up")).toBe(
      true,
    );
    expect(commandGroupMatches(defaults, "podman", "podman run nginx")).toBe(
      false,
    );
  });
});
