import type { ChangesState } from "./state";
import type { KeyBinding } from "../../lib/keyboard/handler";
import type { KeyPattern } from "../../types";
import { Key } from "@earendil-works/pi-tui";
import { ACTION_KEYS } from "../../lib/keyboard/handler";
import type { Navigation } from "./navigation";

export function buildKeyboardBindings(
  state: ChangesState,
  navigation: Navigation,
  callbacks: {
    cycleFilter: (direction: 1 | -1) => void;
    handleNew: () => void;
    handleEdit: () => void;
    handleRevert: () => void;
    handleDescribe: () => void;
    handleSplit: () => void;
    handleInspectChange: () => void;
    handleSquash: () => void;
    handleDrop: () => void;
    setBookmark: () => void;
    pushBookmarks: () => void;
    splitFile: () => void;
    discardFile: () => void;
    applyMoveMode: () => void;
    navigateMove: (direction: "up" | "down") => void;
    openEditor: (path: string) => void;
    onInsert?: (text: string) => void;
    onBookmark?: (changeId: string) => Promise<string | null>;
    onFileCmAction?: (
      path: string,
      action: "inspect" | "deps" | "used-by",
    ) => void;
    finish: () => void;
    requestRender: () => void;
  },
): {
  moveBindings: KeyBinding[];
  leftBindings: KeyBinding[];
  rightBindings: KeyBinding[];
  globalBindings: KeyBinding[];
} {
  const hasSelection = () => !!state.selectedChange;

  const moveBindings: KeyBinding[] = [
    {
      key: "up",
      label: "move",
      handler: () => {
        callbacks.navigateMove("up");
      },
    },
    {
      key: "down",
      handler: () => {
        callbacks.navigateMove("down");
      },
    },
    {
      key: "enter",
      label: "apply",
      handler: () => {
        void callbacks.applyMoveMode();
      },
    },
    {
      key: "escape",
      label: "cancel",
      handler: () => {
        navigation.cancelMoveMode();
        callbacks.requestRender();
      },
    },
  ];

  const changeNavBindings: KeyBinding[] = [
    {
      key: "up",
      handler: () => {
        navigation.navigateChanges("up");
      },
    },
    {
      key: "down",
      handler: () => {
        navigation.navigateChanges("down");
      },
    },
    {
      key: "pageUp",
      label: "scroll",
      handler: () => {
        navigation.navigateChanges("pageUp");
      },
    },
    {
      key: "pageDown",
      handler: () => {
        navigation.navigateChanges("pageDown");
      },
    },
    {
      key: Key.ctrl("/"),
      label: "filter",
      handler: () => {
        callbacks.cycleFilter(1);
        callbacks.requestRender();
      },
    },
    {
      key: "space",
      label: "select",
      when: hasSelection,
      handler: () => {
        if (state.selectedChange) navigation.toggleSelection();
        callbacks.requestRender();
      },
    },
  ];

  const basicChangeActions: KeyBinding[] = [
    {
      key: "n",
      label: "new",
      when: hasSelection,
      handler: () => void callbacks.handleNew(),
    },
    {
      key: "e",
      label: "edit",
      when: hasSelection,
      handler: () => void callbacks.handleEdit(),
    },
    {
      key: "r",
      label: "revert",
      when: hasSelection,
      handler: () => void callbacks.handleRevert(),
    },
    {
      key: "d",
      label: "describe",
      when: () => !!state.selectedChange || state.selectedChangeIds.size > 0,
      handler: () => void callbacks.handleDescribe(),
    },
    {
      key: "s",
      label: "split",
      when: hasSelection,
      handler: () => void callbacks.handleSplit(),
    },
    {
      key: "i",
      label: "inspect",
      when: hasSelection,
      handler: () => void callbacks.handleInspectChange(),
    },
  ];

  const advancedChangeActions: KeyBinding[] = [
    {
      key: "f",
      label: "fixup",
      when: () =>
        !!state.selectedChange &&
        state.changes.length > 1 &&
        state.selectionState.selectedIndex < state.changes.length - 1,
      handler: () => void callbacks.handleSquash(),
    },
    {
      key: Key.ctrl("m"),
      label: "move",
      when: () =>
        !!state.selectedChange &&
        state.changes.length > 1 &&
        state.currentChangeId !== state.selectedChange?.changeId,
      handler: () => {
        navigation.enterMoveMode();
        callbacks.requestRender();
      },
    },
    {
      key: Key.ctrl("i"),
      label: "insert",
      when: () => !!state.selectedChange && callbacks.onInsert !== undefined,
      handler: () => {
        if (state.selectedChange && callbacks.onInsert)
          callbacks.onInsert(state.selectedChange.changeId);
        callbacks.finish();
      },
    },
    {
      key: "b",
      label: "bookmark",
      when: () => hasSelection() && callbacks.onBookmark !== undefined,
      handler: () => void callbacks.setBookmark(),
    },
    {
      key: Key.ctrl("p"),
      label: "push",
      when: () =>
        !!state.selectedChange &&
        state.bookmarksByChange.get(state.selectedChange.changeId)?.length !==
          undefined,
      handler: () => void callbacks.pushBookmarks(),
    },
    {
      key: ACTION_KEYS.delete,
      label: "drop",
      when: hasSelection,
      handler: () => void callbacks.handleDrop(),
    },
  ];

  const changeActionBindings: KeyBinding[] = [
    ...basicChangeActions,
    ...advancedChangeActions,
  ];

  const leftBindings: KeyBinding[] = [
    ...changeNavBindings,
    ...changeActionBindings,
  ];

  const fileNavBindings: KeyBinding[] = [
    {
      key: "up",
      handler: () => {
        navigation.navigateFiles("up");
      },
    },
    {
      key: "down",
      handler: () => {
        navigation.navigateFiles("down");
      },
    },
    {
      key: "pageUp",
      label: "scroll",
      handler: () => {
        navigation.navigateFiles("pageUp");
      },
    },
    {
      key: "pageDown",
      label: "scroll",
      handler: () => {
        navigation.navigateFiles("pageDown");
      },
    },
    {
      key: "e",
      label: "edit",
      when: () => state.files[state.selectionState.fileIndex] !== undefined,
      handler: () => {
        const file = state.files[state.selectionState.fileIndex];
        if (file) callbacks.openEditor(file.path);
      },
    },
    {
      key: "s",
      label: "split",
      when: () =>
        !!state.selectedChange &&
        state.files[state.selectionState.fileIndex] !== undefined,
      handler: () => void callbacks.splitFile(),
    },
    {
      key: "d",
      label: "discard",
      when: () =>
        !!state.selectedChange &&
        state.files[state.selectionState.fileIndex] !== undefined,
      handler: () => void callbacks.discardFile(),
    },
  ];

  const diffScrollBindings: KeyBinding[] = [
    {
      key: Key.ctrl("i"),
      label: "insert",
      when: () => !!state.selectedChange && state.files.length > 0,
      handler: () => {
        const file = state.files[state.selectionState.fileIndex];
        if (!file || !callbacks.onInsert) return;
        callbacks.onInsert(file.path);
        callbacks.finish();
      },
    },
    {
      key: "shift+pageUp",
      label: "scroll",
      handler: () => {
        navigation.scrollDiff("up");
        callbacks.requestRender();
      },
    },
    {
      key: "shift+pageDown",
      handler: () => {
        navigation.scrollDiff("down");
        callbacks.requestRender();
      },
    },
  ];

  function makeFileActionBinding(
    key: KeyPattern,
    label: string,
    action: "inspect" | "deps" | "used-by",
  ): KeyBinding {
    return {
      key,
      label,
      when: () => !!state.selectedChange && state.files.length > 0,
      handler: () => {
        const file = state.files[state.selectionState.fileIndex];
        if (!file || !callbacks.onFileCmAction) return;
        callbacks.onFileCmAction(file.path, action);
      },
    };
  }

  const fileActionBindings: KeyBinding[] = [
    makeFileActionBinding(Key.ctrl("t"), "inspect", "inspect"),
    makeFileActionBinding(Key.ctrl("d"), "deps", "deps"),
    makeFileActionBinding(Key.ctrl("u"), "used-by", "used-by"),
  ];

  const rightBindings: KeyBinding[] = [
    ...fileNavBindings,
    ...fileActionBindings,
    ...diffScrollBindings,
  ];

  const globalBindings: KeyBinding[] = [
    {
      key: "tab",
      label: "pane",
      handler: () => {
        navigation.switchFocus();
        callbacks.requestRender();
      },
    },
    {
      key: "escape",
      handler: () => {
        callbacks.finish();
      },
    },
    {
      key: "q",
      handler: () => {
        callbacks.finish();
      },
    },
  ];

  return { moveBindings, leftBindings, rightBindings, globalBindings };
}

export function getBindingsForPane(
  state: ChangesState,
  moveBindings: KeyBinding[],
  leftBindings: KeyBinding[],
  rightBindings: KeyBinding[],
  globalBindings: KeyBinding[],
): KeyBinding[] {
  if (state.mode === "move") return moveBindings;
  if (state.selectionState.focus === "left")
    return [...globalBindings, ...leftBindings];
  return [...globalBindings, ...rightBindings];
}
