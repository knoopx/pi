import { describe, it, expect } from "vitest";
import defaults from "./permission-gate";
import { commandGroupMatches } from "../test-helpers";

describe("permission-gate", () => {
  it("then confirms sudo, disk ops, permission changes", () => {
    const confirms = [
      "sudo systemctl restart",
      "dd if=/dev/zero of=/dev/sda",
      "mkfs.ext4 /dev/sda1",
      "chmod -R 777 .",
      "chown user -R /var",
    ];
    for (const cmd of confirms) {
      expect(commandGroupMatches(defaults, "permission-gate", cmd)).toBe(true);
    }
  });

  it("then allows normal commands", () => {
    expect(commandGroupMatches(defaults, "permission-gate", "ls -la")).toBe(
      false,
    );
    expect(
      commandGroupMatches(defaults, "permission-gate", "cat file.txt"),
    ).toBe(false);
    expect(commandGroupMatches(defaults, "permission-gate", "echo hello")).toBe(
      false,
    );
  });
});
