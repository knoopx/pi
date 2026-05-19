import type { AgentWorkspace, FileChange, Change } from "../../types";
export interface WorkspaceViewProps {
  workspaces: AgentWorkspace[];
  selectedWorkspace: AgentWorkspace | null;
  files: FileChange[];
  changes: Change[];
  fileIndex: number;
  diffContent: string[];
  diffScroll: number;
  focus: "left" | "right";
  selectedIndex: number;
  loading: boolean;
  helpText: string;
}
