import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

async function hasFileChanges(pi: ExtensionAPI, cwd: string): Promise<boolean> {
  const result = await pi.exec(
    "jj",
    [
      "log",
      "-r",
      "@",
      "--no-graph",
      "-T",
      'if(empty, "empty", "changed") ++ "\n"',
    ],
    { cwd },
  );
  if (result.code !== 0) return false;
  return result.stdout.trim() === "changed";
}

export async function createNewChange(
  pi: ExtensionAPI,
  cwd: string,
  description?: string,
): Promise<{
  success: boolean;
  changeId?: string;
  created: boolean;
  error?: string;
}> {
  const hasChanges = await hasFileChanges(pi, cwd);
  if (!hasChanges) {
    if (description) {
      const describeResult = await pi.exec(
        "jj",
        ["describe", "-m", description],
        { cwd },
      );
      return {
        success: describeResult.code === 0,
        error: describeResult.code !== 0 ? describeResult.stderr : undefined,
        created: false,
      };
    }
    return { success: true, created: false };
  }
  const jjArgs: string[] = ["new"];
  if (description) jjArgs.push("-m", description);
  const result = await pi.exec("jj", jjArgs, { cwd });
  if (result.code === 0) {
    const changeResult = await pi.exec(
      "jj",
      [
        "log",
        "-r",
        "@",
        "--no-graph",
        "-T",
        'change_id ++ coalesce(if(divergent, "/" ++ stringify(change_offset)), "") ++ "\n"',
      ],
      { cwd },
    );
    if (changeResult.code === 0) {
      return {
        success: true,
        changeId: changeResult.stdout.trim(),
        created: true,
      };
    }
    return { success: true, created: true };
  }
  return { success: false, error: result.stderr, created: false };
}
