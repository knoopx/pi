import type { KeyBinding } from "../../lib/keyboard/handler";
import { ACTION_KEYS } from "../../lib/keyboard/handler";
import { createNavigationBindings } from "../../lib/keyboard/bindings";

interface BindingsContext {
  focus: "left" | "right";
  hasWorkspace: () => boolean;
  isDefaultWs: () => boolean;
  isRunningWs: () => boolean;
  hasFile: () => boolean;
  selectedWorkspaceFileStats: unknown;
  terminalRows: number;
  terminalWidth: number;
  diffScroll: number;
  diffContentLength: number;
  onTab: () => void;
  onDone: () => void;
  onNew: () => void;
  onAttach: () => void;
  onRebase: () => void;
  onEdit: () => void;
  onTerminal: () => void;
  onDeleteWorkspace: () => void;
  onNavigateWorkspace: (
    direction: "up" | "down" | "pageUp" | "pageDown",
  ) => void;
  onNavigateFile: (direction: "up" | "down" | "pageUp" | "pageDown") => void;
  onDiscardFile: () => void;
  onScrollDiff: (direction: "up" | "down") => void;
}

export function getGlobalBindings(ctx: BindingsContext): KeyBinding[] {
  return [
    {
      key: "tab",
      label: "nav",
      handler: () => {
        ctx.onTab();
      },
    },
    {
      key: "escape",
      handler: () => {
        ctx.onDone();
      },
    },
    {
      key: "q",
      handler: () => {
        ctx.onDone();
      },
    },
    {
      key: "n",
      label: "new",
      handler: () => {
        ctx.onNew();
      },
    },
  ];
}

export function getWorkspaceActionBindings(ctx: BindingsContext): KeyBinding[] {
  return [
    {
      key: "a",
      label: "attach",
      when: () => ctx.hasWorkspace() && !ctx.isDefaultWs() && ctx.isRunningWs(),
      handler: () => {
        ctx.onAttach();
      },
    },
    {
      key: "r",
      label: "rebase",
      when: () =>
        ctx.hasWorkspace() &&
        !ctx.isDefaultWs() &&
        ctx.selectedWorkspaceFileStats !== undefined,
      handler: () => {
        ctx.onRebase();
      },
    },
    {
      key: "e",
      label: "edit",
      when: () => ctx.hasWorkspace(),
      handler: () => {
        ctx.onEdit();
      },
    },
    {
      key: "t",
      label: "term",
      when: () => ctx.hasWorkspace(),
      handler: () => {
        ctx.onTerminal();
      },
    },
    {
      key: ACTION_KEYS.delete,
      label: "delete",
      when: () => ctx.hasWorkspace() && !ctx.isDefaultWs(),
      handler: () => {
        ctx.onDeleteWorkspace();
      },
    },
  ];
}

export function getLeftPaneBindings(ctx: BindingsContext): KeyBinding[] {
  return createNavigationBindings((direction) => {
    ctx.onNavigateWorkspace(direction);
  });
}

export function getRightPaneBindings(ctx: BindingsContext): KeyBinding[] {
  return [
    ...createNavigationBindings((direction) => {
      ctx.onNavigateFile(direction);
    }),
    {
      key: "d",
      label: "discard",
      when: () => ctx.hasWorkspace() && !ctx.isDefaultWs() && ctx.hasFile(),
      handler: () => {
        ctx.onDiscardFile();
      },
    },
    {
      key: "shift+pageUp",
      label: "scroll",
      handler: () => {
        ctx.onScrollDiff("up");
      },
    },
    {
      key: "shift+pageDown",
      handler: () => {
        ctx.onScrollDiff("down");
      },
    },
  ];
}
