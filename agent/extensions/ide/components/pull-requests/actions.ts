import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ListPickerComponent } from "../../lib/list-picker";
import { notifyMutation } from "../../jj/core";


export async function executeGhCommand(options: {
  pi: ExtensionAPI;
  args: string[];
  cwd: string;
  successMsg: string;
  errorMsg: string;
  pickerRef?: ListPickerComponent | null;
}): Promise<boolean> {
  const { pi, args, cwd, successMsg, errorMsg, pickerRef } = options;
  const result = await pi.exec("gh", args, { cwd });
  if (result.code === 0) {
    notifyMutation(pi, successMsg, result.stderr || result.stdout);
    await pickerRef?.reload();
    return true;
  }
  notifyMutation(pi, "error", result.stderr || errorMsg);
  return false;
}

export async function openPrInBrowser(
  pi: ExtensionAPI,
  prNumber: number,
  cwd: string,
): Promise<void> {
  await pi.exec("gh", ["pr", "view", String(prNumber), "--web"], { cwd });
  notifyMutation(pi, "info", `Opened PR #${prNumber} in browser`);
}
