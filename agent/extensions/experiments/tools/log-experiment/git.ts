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
  return await pi.exec("git", args, { cwd: workDir, timeout });
}

export async function handleGitCommit(
  pi: ExtensionAPI,
  workDir: string,
  result: { description: string },
): Promise<GitResult> {
  try {
    const addResult = await runGitOrError(
      pi,
      workDir,
      "git add",
      ["add", "-A"],
      30,
    );
    if (!addResult.ok) return addResult;

    const commitResult = await runGit(
      pi,
      workDir,
      ["commit", "-m", `experiment: ${result.description}`],
      30,
    );
    if (commitResult.code !== 0) {
      return handleCommitError(commitResult);
    }
    return { ok: true, output: commitResult.stdout || "Committed" };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}

function handleCommitError(result: {
  stdout: string;
  stderr: string;
}): GitResult {
  const stderr = result.stderr || result.stdout;
  if (stderr.includes("nothing to commit")) {
    return { ok: true, output: "No changes to commit" };
  }
  return gitError("git commit", { stdout: stderr, stderr: stderr });
}

async function runGitOrError(
  pi: ExtensionAPI,
  workDir: string,
  label: string,
  args: string[],
  timeout: number,
): Promise<GitResult> {
  const result = await runGit(pi, workDir, args, timeout);
  if (result.code !== 0) return gitError(label, result);
  return { ok: true, output: "ok" };
}

async function revertGitChanges(
  pi: ExtensionAPI,
  workDir: string,
): Promise<GitResult> {
  const statusResult = await runGit(pi, workDir, ["status", "--porcelain"], 10);
  if (statusResult.code !== 0 || !(statusResult.stdout || "").trim()) {
    return { ok: true, output: "No changes to revert" };
  }

  const restore = await runGitOrError(
    pi,
    workDir,
    "git restore --staged",
    ["restore", "--staged", "."],
    30,
  );
  if (!restore.ok) return restore;

  const checkout = await runGitOrError(
    pi,
    workDir,
    "git checkout",
    ["checkout", "."],
    30,
  );
  if (!checkout.ok) return checkout;

  return { ok: true, output: "Changes reverted" };
}

export async function handleGitRevert(
  pi: ExtensionAPI,
  workDir: string,
  result: { status: string },
): Promise<GitResult> {
  if (result.status !== "discard" && result.status !== "crash") {
    return { ok: true, output: "No revert needed" };
  }
  try {
    return await revertGitChanges(pi, workDir);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, output: msg };
  }
}
