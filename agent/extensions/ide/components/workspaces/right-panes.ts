import type { Theme } from "@mariozechner/pi-coding-agent";
import { ChangeListPane } from "../../lib/split-panel/change-list-pane";
import { FileListPane } from "../../lib/split-panel/file-list-pane";
import { DiffPane } from "../../lib/split-panel/diff-pane";
import type { AgentWorkspace, FileChange, Change } from "../../lib/types";

interface RightPanesProps {
  selectedWorkspace: AgentWorkspace | null;
  files: FileChange[];
  changes: Change[];
  fileIndex: number;
  diffContent: string[];
  diffScroll: number;
  loading: boolean;
  focus: "left" | "right";
  rightTopH: number;
  rightBottomH: number;
  rightW: number;
  rightBottomTitle: string;
  theme: Theme;
}


export function createRightPanes(props: RightPanesProps): {
  rightTop: string[];
  rightBottom: string[];
} {
  const isDefault = props.selectedWorkspace?.name === "default";
  const rightTopTitle = isDefault ? " Changes" : " Files";

  const rightTop = isDefault
    ? new ChangeListPane({
        changes: props.changes.map((c) => ({
          ...c,
          immutable: c.immutable ?? false,
          description: c.description,
          empty: c.empty ?? false,
        })),
        selectedIndex: props.fileIndex,
        selectedChangeIds: new Set(),
        currentChangeId: null,
        bookmarksByChange: new Map(),
        graphLayout: null,
        loadingState: { loading: props.loading },
        focus: props.focus,
        side: "right",
        height: props.rightTopH,
        theme: props.theme,
      }).render(props.rightW)
    : new FileListPane({
        files: props.files,
        selectedIndex: props.fileIndex,
        title: rightTopTitle,
        height: props.rightTopH,
        focus: props.focus,
        theme: props.theme,
      }).render(props.rightW);

  const rightBottom = new DiffPane({
    lines: props.diffContent,
    scroll: props.diffScroll,
    width: props.rightW,
    height: props.rightBottomH,
    title: props.rightBottomTitle,
    focus: props.focus,
    theme: props.theme,
  }).render(props.rightW);

  return { rightTop, rightBottom };
}
