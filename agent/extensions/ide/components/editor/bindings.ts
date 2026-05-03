import type { Editor } from "./editor";
import type { KeyBinding } from "../../keyboard";
import { Key } from "@mariozechner/pi-tui";

export function buildBindings(
  e: Editor,
  requestRender: () => void,
): KeyBinding[] {
  return [
    ...buildNavBindings(e, requestRender),
    ...buildActionBindings(e, requestRender),
    ...buildEditBindings(e, requestRender),
  ];
}

function buildNavBindings(e: Editor, requestRender: () => void): KeyBinding[] {
  return [
    {
      key: "up",
      label: "nav",
      handler: () => {
        e.moveCursor("up", false);
        requestRender();
      },
    },
    {
      key: "down",
      handler: () => {
        e.moveCursor("down", false);
        requestRender();
      },
    },
    {
      key: "left",
      handler: () => {
        e.moveCursor("left", false);
        requestRender();
      },
    },
    {
      key: "right",
      handler: () => {
        e.moveCursor("right", false);
        requestRender();
      },
    },
    {
      key: "pageUp",
      label: "scroll",
      handler: () => {
        e.movePageUp(false);
        requestRender();
      },
    },
    {
      key: "pageDown",
      handler: () => {
        e.movePageDown(false);
        requestRender();
      },
    },
    {
      key: "home",
      label: "start",
      handler: () => {
        e.moveToLineStart(false);
        requestRender();
      },
    },
    {
      key: "end",
      label: "end",
      handler: () => {
        e.moveToLineEnd(false);
        requestRender();
      },
    },
  ];
}

function buildActionBindings(
  e: Editor,
  requestRender: () => void,
): KeyBinding[] {
  return [
    {
      key: Key.ctrl("s"),
      label: "save",
      handler: () => {
        requestRender();
      },
    },
    {
      key: Key.ctrl("z"),
      label: "undo",
      handler: () => {
        e.undo();
        requestRender();
      },
    },
    {
      key: Key.ctrl("y"),
      label: "redo",
      handler: () => {
        e.redo();
        requestRender();
      },
    },
  ];
}

function buildEditBindings(
  _e: Editor,
  requestRender: () => void,
): KeyBinding[] {
  return [
    {
      key: Key.ctrl("a"),
      label: "select all",
      handler: () => {
        requestRender();
      },
    },
    {
      key: Key.ctrl("/"),
      label: "comment",
      handler: () => {
        requestRender();
      },
    },
    {
      key: "delete",
      label: "del fwd",
      handler: () => {
        requestRender();
      },
    },
    {
      key: "shift+delete",
      label: "del line",
      handler: () => {
        requestRender();
      },
    },
    {
      key: Key.ctrl("backspace"),
      label: "del word",
      handler: () => {
        requestRender();
      },
    },
    {
      key: Key.ctrl("delete"),
      label: "del word fwd",
      handler: () => {
        requestRender();
      },
    },
  ];
}
