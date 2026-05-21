import type { AgentWorkspace, FileChange, Change } from "../../types";
interface WorkspaceViewTitles {
  leftTitle: string;
  rightTopTitle: string;
  rightBottomTitle: string;
}
function computeRightBottomTitle(
  selectedWorkspace: AgentWorkspace | null,
  isDefault: boolean,
  files: FileChange[],
  changes: Change[],
  fileIndex: number,
): string {
  if (!selectedWorkspace) return " Diff";
  const label = isDefault
    ? formatChangeId(changes[fileIndex])
    : (files[fileIndex]?.path ?? "all");
  return ` Diff: ${label}`;
}

function formatChangeId(change: Change | undefined): string {
  return change?.changeId?.slice(0, 8) ?? "none";
}

export function computeWorkspaceViewTitles(
  selectedWorkspace: AgentWorkspace | null,
  files: FileChange[],
  changes: Change[],
  fileIndex: number,
): WorkspaceViewTitles {
  const isDefault = selectedWorkspace?.name === "default";
  return {
    leftTitle: " Workspaces",
    rightTopTitle: isDefault ? " Changes" : " Files",
    rightBottomTitle: computeRightBottomTitle(
      selectedWorkspace,
      isDefault,
      files,
      changes,
      fileIndex,
    ),
  };
}
