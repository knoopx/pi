import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentWorkspace } from "../../types";
import type {
  WorkspaceState,
  WorkspaceCacheStore,
  WorkspaceCache,
} from "./loading";
import { formatErrorMessage } from "../../lib/ui/footer";
import { THEME } from "../../tools/shiki/constants";
import { renderDiffWithShiki } from "../../tools/diff";

export interface DiffLoadingContext {
  pi: ExtensionAPI;
  state: WorkspaceState;
  cacheStore: WorkspaceCacheStore;
  setDiffContent: (content: string[]) => void;
  invalidate: () => void;
}

export async function loadDiffForCurrentSelection(
  ctx: DiffLoadingContext,
): Promise<void> {
  if (!ctx.state.selectedWorkspace) return;
  const ws = ctx.state.selectedWorkspace;
  try {
    if (ws.name === "default") {
      await loadDefaultWorkspaceDiff(ctx, ws);
    } else {
      await loadWorkspaceFileDiff(ctx, ws);
    }
  } catch (error) {
    const msg = formatErrorMessage(error);
    ctx.state.diffContent = [`Error: ${msg}`];
  }
  ctx.invalidate();
}

async function loadDefaultWorkspaceDiff(
  ctx: DiffLoadingContext,
  ws: AgentWorkspace,
): Promise<void> {
  const { getRawDiff } = await import("../../jj/files");
  const cache = getOrCreateCache(ctx, ws.name, () => ({
    files: [],
    changes: ctx.state.changes,
    diffs: new Map(),
  }));
  const changeId = ctx.state.changes[ctx.state.fileIndex]?.changeId;
  if (!changeId) {
    ctx.setDiffContent([]);
    return;
  }

  const content = await loadCachedOrFetchDiff(cache, changeId, async () => {
    const { diff } = await getRawDiff(ctx.pi, ws.path, changeId);
    return renderDiffWithShiki(diff, THEME);
  });
  ctx.setDiffContent(content);
}

async function loadWorkspaceFileDiff(
  ctx: DiffLoadingContext,
  ws: AgentWorkspace,
): Promise<void> {
  const { getRawDiff } = await import("../../jj/files");
  const cache = getOrCreateCache(ctx, ws.name, () => ({
    files: ctx.state.files,
    changes: [],
    diffs: new Map(),
  }));
  const file = ctx.state.files[ctx.state.fileIndex];
  if (!file) {
    ctx.setDiffContent([]);
    return;
  }
  const diffKey = file.path ?? "";
  const content = await loadCachedOrFetchDiff(cache, diffKey, async () => {
    const { diff } = await getRawDiff(ctx.pi, ws.path, "@", file.path);
    return renderDiffWithShiki(diff, THEME);
  });
  ctx.setDiffContent(content);
}

function getOrCreateCache(
  ctx: DiffLoadingContext,
  name: string,
  factory: () => WorkspaceCache,
): WorkspaceCache {
  let cache = ctx.cacheStore.get(name);
  if (!cache) {
    cache = factory();
    ctx.cacheStore.set(name, cache);
  }
  return cache;
}

async function loadCachedOrFetchDiff(
  cache: WorkspaceCache,
  key: string,
  fetcher: () => Promise<string[]>,
): Promise<string[]> {
  const cached = cache.diffs.get(key);
  if (cached) {
    return cached;
  }
  const content = await fetcher();
  cache.diffs.set(key, content);
  return content;
}
