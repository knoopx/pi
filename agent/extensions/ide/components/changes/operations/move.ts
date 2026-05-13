import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ChangesState } from "../state";
import type { Change } from "../../../types";
import { notifyMutation } from "../../../jj/core";
import { formatErrorMessage } from "../../../lib/ui/footer";

interface MoveOpsContext {
  pi: ExtensionAPI;
  cwd: string;
  state: ChangesState;
  refreshAfterMutation: () => Promise<void>;
  notify: (msg: string, type?: "info" | "error") => void;
  requestRender: () => void;
  cancelMoveMode: () => void;
  navigateMove: (direction: "up" | "down") => void;
  onChangeSelected: (changeId: string) => void | Promise<void>;
}

export async function applyMoveMode(ctx: MoveOpsContext): Promise<void> {
  if (ctx.state.mode !== "move") return;
  const currentIndex = ctx.state.selectionState.selectedIndex;
  if (currentIndex === ctx.state.moveOriginalIndex) {
    ctx.state.mode = "normal";
    ctx.requestRender();
    return;
  }

  try {
    await performRebase(ctx);
    ctx.state.mode = "normal";
    ctx.state.changeCache.clear();
    await ctx.refreshAfterMutation();
  } catch (error) {
    ctx.notify(`Failed to move: ${formatErrorMessage(error)}`, "error");
    ctx.cancelMoveMode();
  }
}

async function performRebase(ctx: MoveOpsContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  const plan = resolveRebasePlan(ctx.state);
  if (!plan) return;
  const change = ctx.state.selectedChange;
  const result = await ctx.pi.exec(
    "jj",
    ["rebase", "-r", change.changeId, plan.flag, plan.targetChangeId],
    { cwd: ctx.cwd },
  );

  notifyMutation(
    ctx.pi,
    `Moved change ${change.changeId.slice(0, 8)} after ${plan.targetChangeId}`,
    pickOutput(result.stderr, result.stdout),
  );
}

function resolveRebasePlan(
  state: ChangesState,
): { targetChangeId: string; flag: string } | null {
  const { currentIndex, originalIndex } = getRebaseOffsets(state);
  const { targetChange, flag } = resolveRebaseTarget(
    state,
    currentIndex,
    originalIndex,
  );
  if (!targetChange) return null;
  return { targetChangeId: targetChange.changeId.slice(0, 8), flag };
}

function getRebaseOffsets(state: ChangesState): {
  currentIndex: number;
  originalIndex: number;
} {
  return {
    currentIndex: state.selectionState.selectedIndex,
    originalIndex: state.moveOriginalIndex,
  };
}

function resolveRebaseTarget(
  state: ChangesState,
  currentIndex: number,
  originalIndex: number,
): { targetChange: Change | null; flag: string } {
  const goingUp = currentIndex < originalIndex;
  const target = state.changes[goingUp ? currentIndex + 1 : currentIndex - 1];
  return {
    targetChange: target ?? null,
    flag: goingUp ? "--after" : "--before",
  };
}

export function navigateMove(ctx: MoveOpsContext): void {
  try {
    const direction =
      ctx.state.selectionState.selectedIndex < ctx.state.moveOriginalIndex
        ? "up"
        : "down";
    ctx.navigateMove(direction);
    selectChangeAt(ctx);
  } catch (error) {
    ctx.notify(
      `Changes component update failed: ${formatErrorMessage(error)}`,
      "error",
    );
  }
  ctx.requestRender();
}

function selectChangeAt(ctx: MoveOpsContext): void {
  const change = ctx.state.changes[ctx.state.selectionState.selectedIndex];
  if (!change) return;

  ctx.state.selectedChange = change;
  const result = ctx.onChangeSelected(change.changeId);
  if (result instanceof Promise) {
    void result.catch((error) => {
      ctx.notify(
        `onChangeSelected failed: ${formatErrorMessage(error)}`,
        "error",
      );
    });
  }
}

function pickOutput(stderr: string, stdout: string): string {
  if (stderr) return stderr;
  return stdout || "";
}
