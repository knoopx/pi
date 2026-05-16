import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface GitResult {
  ok: boolean;
  output: string;
}

function gitError(
  cmd: string,
  result: { stdout: string; stderr: string },
): GitResult {
  return {
    ok: false,
    output: `${cmd} failed: ${result.stderr || result.stdout}`,
  };
}

async function runGit(
  pi: ExtensionAPI,
  workDir: string,
  args: string[],
  timeout: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    return await pi.exec("git", args, { cwd: workDir, timeout });
  } catch (e) {
    throw e;
  }
}

export async function handleGitCommit(
  pi: ExtensionAPI,
  workDir: string,
  result: { description: string },
): Promise<GitResult> {
  try {
    const addResult = await runGit(pi, workDir, ["add", "-A"], 30);
    if (addResult.code !== 0) {
      return gitError("git add", addResult);
    }
    const commitResult = await runGit(
      pi,
      workDir,
      ["commit", "-m", `experiment: ${result.description}`],
      30,
    );
    if (commitResult.code !== 0) {
      const stderr = commitResult.stderr || commitResult.stdout;
      if (stderr.includes("nothing to commit")) {
        return { ok: true, output: "No changes to commit" };
      }
      return gitError("git commit", { stdout: stderr, stderr: stderr });
    }
    return { ok: true, output: commitResult.stdout || "Committed" };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}

export async function handleGitRevert(
  pi: ExtensionAPI,
  workDir: string,
  result: { status: string },
): Promise<GitResult> {
  const isDiscard = result.status === "discard" || result.status === "crash";
  if (!isDiscard) return { ok: true, output: "No revert needed" };

  try {
    const statusResult = await runGit(
      pi,
      workDir,
      ["status", "--porcelain"],
      10,
    );
    const hasChanges =
      statusResult.code === 0 && (statusResult.stdout || "").trim().length > 0;
    if (!hasChanges) {
      return { ok: true, output: "No changes to revert" };
    }

    const restoreResult = await runGit(
      pi,
      workDir,
      ["restore", "--staged", "."],
      30,
    );
    if (restoreResult.code !== 0) {
      return gitError("git restore --staged", restoreResult);
    }

    const checkoutResult = await runGit(pi, workDir, ["checkout", "."], 30);
    if (checkoutResult.code !== 0) {
      return gitError("git checkout", checkoutResult);
    }

    return { ok: true, output: "Changes reverted" };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}
