import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ChangesState } from "../state";
import { getSelectedChanges } from "../state-utils";

interface MutateContext {
  pi: ExtensionAPI;
  cwd: string;
  state: ChangesState;
  refreshAfterMutation: () => Promise<void>;
  restoreSelection: (prevIndex: number) => Promise<void>;
  notify: (msg: string, type?: "info" | "error") => void;
}

export async function editChange(ctx: MutateContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  await ctx.pi.exec("jj", ["edit", ctx.state.selectedChange.changeId], {
    cwd: ctx.cwd,
  });
  await ctx.refreshAfterMutation();
  ctx.notify(
    `Set working copy to change ${ctx.state.selectedChange.changeId.slice(0, 8)}`,
  );
}

export async function squashChange(ctx: MutateContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  const originalChangeId = ctx.state.selectedChange.changeId;
  const parentChangeId = ctx.state.selectedChange.parentIds?.[0]?.slice(0, 8);
  await ctx.pi.exec(
    "jj",
    ["squash", "-u", "-r", originalChangeId],
    { cwd: ctx.cwd },
  );
  await runMutationFlow(ctx);
  const msg = parentChangeId
    ? `Squashed change ${originalChangeId.slice(0, 8)} into change ${parentChangeId}`
    : `Squashed change ${originalChangeId.slice(0, 8)}`;
  ctx.notify(msg);
}

export async function dropChange(ctx: MutateContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  const originalChangeId = ctx.state.selectedChange.changeId;
  await ctx.pi.exec("jj", ["abandon", originalChangeId], { cwd: ctx.cwd });
  ctx.state.selectedChangeIds.delete(originalChangeId);
  await runMutationFlow(ctx);
  ctx.notify(`Dropped change ${originalChangeId}`);
}

export async function newChange(ctx: MutateContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  await ctx.pi.exec("jj", ["new", ctx.state.selectedChange.changeId], {
    cwd: ctx.cwd,
  });
  await ctx.refreshAfterMutation();
  const msg = ctx.state.currentChangeId
    ? `Created change ${ctx.state.currentChangeId} from change ${ctx.state.selectedChange.changeId.slice(0, 8)}`
    : `Started a child change from change ${ctx.state.selectedChange.changeId.slice(0, 8)}`;
  ctx.notify(msg);
}

export async function revertChange(ctx: MutateContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  await ctx.pi.exec(
    "jj",
    [
      "revert",
      "-r",
      ctx.state.selectedChange.changeId,
      "--insert-after",
      "@",
    ],
    { cwd: ctx.cwd },
  );
  await ctx.refreshAfterMutation();
  ctx.notify(
    `Reverted change ${ctx.state.selectedChange.changeId.slice(0, 8)}`,
  );
}

export function getSelectedChangesFn(ctx: MutateContext) {
  return getSelectedChanges(ctx.state);
}

async function runMutationFlow(ctx: MutateContext): Promise<void> {
  const prevIndex = ctx.state.selectionState.selectedIndex;
  await ctx.refreshAfterMutation();
  await ctx.restoreSelection(prevIndex);
}
