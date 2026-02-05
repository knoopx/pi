import { describe, it, expect } from "vitest";
import { isGroupActive, substituteVariables } from "./index";

describe("isGroupActive", () => {
  const testDir = import.meta.dirname;

  it("returns true for wildcard pattern", async () => {
    const result = await isGroupActive("*", testDir);
    expect(result).toBe(true);
  });

  it("returns true when matching files exist", async () => {
    // package.json exists in this directory
    const result = await isGroupActive("package.json", testDir);
    expect(result).toBe(true);
  });

  it("returns false when no matching files exist", async () => {
    const result = await isGroupActive("nonexistent-file-xyz.json", testDir);
    expect(result).toBe(false);
  });

  it("returns true for glob patterns that match", async () => {
    // *.ts should match this test file
    const result = await isGroupActive("*.ts", import.meta.dirname);
    expect(result).toBe(true);
  });

  it("returns false for glob patterns that dont match", async () => {
    const result = await isGroupActive("*.xyz", import.meta.dirname);
    expect(result).toBe(false);
  });
});

describe("substituteVariables", () => {
  it("substitutes ${file} variable", () => {
    const result = substituteVariables('biome format "${file}"', {
      file: "src/index.ts",
      cwd: "/home/user/project",
    });
    expect(result).toBe('biome format "src/index.ts"');
  });

  it("substitutes ${tool} variable", () => {
    const result = substituteVariables("echo ${tool}", {
      tool: "write",
      cwd: "/home/user/project",
    });
    expect(result).toBe("echo write");
  });

  it("substitutes ${cwd} variable", () => {
    const result = substituteVariables("cd ${cwd} && ls", {
      cwd: "/home/user/project",
    });
    expect(result).toBe("cd /home/user/project && ls");
  });

  it("substitutes multiple variables", () => {
    const result = substituteVariables('echo "${tool}: ${file}" in ${cwd}', {
      file: "test.ts",
      tool: "edit",
      cwd: "/tmp",
    });
    expect(result).toBe('echo "edit: test.ts" in /tmp');
  });

  it("replaces undefined variables with empty string", () => {
    const result = substituteVariables("command ${file}", {
      cwd: "/home/user",
    });
    expect(result).toBe("command ");
  });

  it("handles multiple occurrences of same variable", () => {
    const result = substituteVariables("${file} and ${file}", {
      file: "test.ts",
      cwd: "/tmp",
    });
    expect(result).toBe("test.ts and test.ts");
  });
});
