import type { AgentWorkspace, FileChange, Change } from "../../lib/types";

interface WorkspaceViewTitles {
  leftTitle: string;
  rightTopTitle: string;
  rightBottomTitle: string;
}


export function computeWorkspaceViewTitles(
  selectedWorkspace: AgentWorkspace | null,
  files: FileChange[],
  changes: Change[],
  fileIndex: number,
): WorkspaceViewTitles {
  const isDefault = selectedWorkspace?.name === "default";
  const leftTitle = " Workspaces";
  const rightTopTitle = isDefault ? " Changes" : " Files";

  let rightBottomTitle: string;
  if (!selectedWorkspace) {
    rightBottomTitle = " Diff";
  } else if (isDefault) {
    const changeId = changes[fileIndex]?.changeId?.slice(0, 8);
    rightBottomTitle = ` Diff: ${changeId ?? "none"}`;
  } else {
    const filePath = files[fileIndex]?.path;
    rightBottomTitle = ` Diff: ${filePath ?? "all"}`;
  }

  return { leftTitle, rightTopTitle, rightBottomTitle };
}
