/**
 * DataService — encapsulates all jj command execution.
 * No UI dependencies, pure data operations.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Change, FileChange } from "../../types";

/** Filter bookmark entries that match a change ID (bidirectional prefix match). */
function filterBookmarksForChange(
  entries: { bookmark: string; changeId: string }[],
  changeId: string,
): string[] {
  return entries
    .filter(
      (e) => changeId.startsWith(e.changeId) || e.changeId.startsWith(changeId),
    )
    .map((e) => e.bookmark);
}
import {
  loadChanges,
  getCurrentChangeIdShort,
  loadChangedFiles,
  listBookmarksByChange,
  getRawDiff as jjGetRawDiff,
} from "../../jj";

export class DataService {
  constructor(
    public readonly pi: ExtensionAPI,
    public readonly cwd: string,
  ) {}

  async loadChanges(revision = "ancestors(@) ~ root()"): Promise<Change[]> {
    return loadChanges(this.pi, this.cwd, revision);
  }

  async getCurrentChangeIdShort(): Promise<string | null> {
    return getCurrentChangeIdShort(this.pi, this.cwd);
  }

  async loadChangedFiles(changeId: string): Promise<FileChange[]> {
    return loadChangedFiles(this.pi, this.cwd, changeId);
  }

  async getRawDiff(changeId: string, filePath?: string): Promise<string> {
    const { diff } = await jjGetRawDiff(this.pi, this.cwd, changeId, filePath);
    return diff;
  }

  async listBookmarksByChange(): Promise<
    { bookmark: string; changeId: string }[]
  > {
    const entries = await listBookmarksByChange(this.pi, this.cwd);
    return entries.map(({ bookmark, changeId }) => ({ bookmark, changeId }));
  }

  async getBookmarksForChanges(
    changes: Change[],
  ): Promise<Map<string, string[]>> {
    const entries = await this.listBookmarksByChange();
    const result = new Map<string, string[]>();
    for (const change of changes) {
      const bookmarks = filterBookmarksForChange(entries, change.changeId);
      if (bookmarks.length > 0) result.set(change.changeId, bookmarks);
    }
    return result;
  }
}
