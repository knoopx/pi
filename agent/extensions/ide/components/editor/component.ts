import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import type { Component, Focusable, TUI } from "@mariozechner/pi-tui";
import { Key } from "@mariozechner/pi-tui";
import { basename } from "node:path";

import {
  createKeyboardHandler,
  buildHelpFromBindings,
  filterActiveBindings,
  type KeyBinding,
} from "../../keyboard";
import { Editor } from "./editor";
import { renderEditorView, type RenderOptions } from "./renderer";
import { BOX } from "../../lib/ui/frame";
import { ensureWidth, pad } from "../../lib/text-utils";
import {
  createStatusNotifier,
  formatHelpWithStatus,
  type StatusMessageState,
} from "../../lib/ui/status";
import { highlightCode } from "../../tools/shiki/highlight";
import { lang } from "../../tools/language";

export interface EditorResult {
  saved: boolean;
}

interface CreateEditorOptions {
  pi: ExtensionAPI;
  tui: TUI;
  theme: Theme;
  done: (result: EditorResult | null) => void;
  filePath: string;
  content: string;
  cursorLine?: number;
}

export function createEditorComponent(
  opts: CreateEditorOptions,
): Component & Focusable {
  return new EditorComponent(opts);
}

class EditorComponent implements Component, Focusable {
  focused = false;

  private editor: Editor;
  private cachedWidth?: number;
  private cachedLines?: string[];
  private saved = false;
  private hlCache = new Map<string, readonly string[]>();
  private keyboardHandler: (data: string) => boolean;
  private bindings: KeyBinding[];
  private statusState: StatusMessageState = { message: null, timeout: null };

  constructor(private opts: CreateEditorOptions) {
    this.editor = new Editor(opts.content);
    this.editor.setViewHeight(this.opts.tui.terminal.rows);
    if (opts.cursorLine !== undefined && opts.cursorLine >= 0) {
      this.editor.setCursor(opts.cursorLine, 0);
    }

    this.bindings = this.buildBindings();
    this.opts.tui.setFocus(this);
    this.keyboardHandler = createKeyboardHandler({
      bindings: this.bindings,
      getContext: () => this as never,
      onEscape: () => this.quit(),
      onEnter: () => {
        this.editor.insertNewline();
        this.requestRender();
      },
      onBackspace: () => {
        this.editor.deleteCharBackward();
        this.requestRender();
      },
      onTextInput: (char) => {
        this.handleCharInput(char);
      },
    });
  }

  private buildBindings(): KeyBinding[] {
    const e = this.editor;
    return [
      ...this.buildNavBindings(e),
      ...this.buildActionBindings(e),
      ...this.buildEditBindings(e),
    ];
  }

  private buildNavBindings(e: Editor): KeyBinding[] {
    return [
      {
        key: "up",
        label: "nav",
        handler: () => {
          e.moveCursor("up", false);
          this.requestRender();
        },
      },
      {
        key: "down",
        handler: () => {
          e.moveCursor("down", false);
          this.requestRender();
        },
      },
      {
        key: "left",
        handler: () => {
          e.moveCursor("left", false);
          this.requestRender();
        },
      },
      {
        key: "right",
        handler: () => {
          e.moveCursor("right", false);
          this.requestRender();
        },
      },
      {
        key: "pageUp",
        label: "scroll",
        handler: () => {
          e.movePageUp(false);
          this.requestRender();
        },
      },
      {
        key: "pageDown",
        handler: () => {
          e.movePageDown(false);
          this.requestRender();
        },
      },
      {
        key: "home",
        label: "start",
        handler: () => {
          e.moveToLineStart(false);
          this.requestRender();
        },
      },
      {
        key: "end",
        label: "end",
        handler: () => {
          e.moveToLineEnd(false);
          this.requestRender();
        },
      },
    ];
  }

  private buildActionBindings(e: Editor): KeyBinding[] {
    return [
      {
        key: Key.ctrl("s"),
        label: "save",
        handler: () => {
          void this.saveFile();
          this.notify("Saved", "info");
          this.requestRender();
        },
      },
      {
        key: Key.ctrl("z"),
        label: "undo",
        handler: () => {
          e.undo();
          this.requestRender();
        },
      },
      {
        key: Key.ctrl("y"),
        label: "redo",
        handler: () => {
          e.redo();
          this.requestRender();
        },
      },
    ];
  }

  private buildEditBindings(_e: Editor): KeyBinding[] {
    const e = this.editor;
    return [
      {
        key: Key.ctrl("a"),
        label: "select all",
        handler: () => {
          e.selectAll();
          this.requestRender();
        },
      },
      {
        key: Key.ctrl("/"),
        label: "comment",
        handler: () => {
          e.toggleComment();
          this.requestRender();
        },
      },
      {
        key: "delete",
        label: "del fwd",
        handler: () => {
          e.deleteCharForward();
          this.requestRender();
        },
      },
      {
        key: "shift+delete",
        label: "del line",
        handler: () => {
          e.deleteLine();
          this.requestRender();
        },
      },
      {
        key: Key.ctrl("backspace"),
        label: "del word",
        handler: () => {
          e.deleteWordBackward();
          this.requestRender();
        },
      },
      {
        key: Key.ctrl("delete"),
        label: "del word fwd",
        handler: () => {
          e.deleteWordForward();
          this.requestRender();
        },
      },
    ];
  }

  private get pi(): ExtensionAPI {
    return this.opts.pi;
  }

  private get tui(): TUI {
    return this.opts.tui;
  }

  private get theme(): Theme {
    return this.opts.theme;
  }

  private get filePath(): string {
    return this.opts.filePath;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  private requestRender(): void {
    this.invalidate();
    this.tui.requestRender();
  }

  notify(message: string, type: "info" | "error" = "info"): void {
    const notifier = createStatusNotifier(this.statusState, () => {
      this.requestRender();
    });
    notifier(message, type);
  }

  private computeHlKey(lines: readonly string[]): string {
    return `${this.filePath}\0${lines.join("\n")}`;
  }

  private getCachedDisplayLines(hlKey: string): readonly string[] | undefined {
    return this.hlCache.get(hlKey);
  }

  private getEditorState(): {
    cursor: { line: number; col: number };
    topLine: number;
    selection: {
      start: { line: number; col: number };
      end: { line: number; col: number };
    } | null;
  } {
    return {
      cursor: this.editor.getCursor(),
      topLine: this.editor.getTopLine(),
      selection: this.editor.hasSelection() ? this.editor.getSelection() : null,
    };
  }

  private resolveDisplayLinesSync(lines: readonly string[]): readonly string[] {
    const hlKey = this.computeHlKey(lines);
    const cached = this.getCachedDisplayLines(hlKey);
    if (cached) return cached;

    this.hlCache.set(hlKey, lines);
    return lines;
  }

  private async tryHighlight(
    source: string,
  ): Promise<readonly string[] | null> {
    try {
      const language = lang(this.filePath);
      return await highlightCode(source, language, undefined);
    } catch {
      return null;
    }
  }

  private async resolveDisplayLinesAsync(
    lines: readonly string[],
  ): Promise<readonly string[]> {
    const hlKey = this.computeHlKey(lines);
    const cached = this.getCachedDisplayLines(hlKey);
    if (cached) return cached;

    const highlighted = await this.tryHighlight(lines.join("\n"));
    if (highlighted) {
      this.hlCache.set(hlKey, highlighted);
      return highlighted;
    }

    this.hlCache.set(hlKey, lines);
    return lines;
  }

  private renderEditorContentSync(
    innerWidth: number,
    height: number,
  ): { lines: string[] } {
    const lines = this.editor.getLines();
    const displayLines = this.resolveDisplayLinesSync(lines);
    const { cursor, topLine, selection } = this.getEditorState();

    return this.renderWithDisplayLines({
      displayLines,
      innerWidth,
      height,
      cursor,
      topLine,
      selection,
    });
  }

  private async updateHighlightCache(): Promise<void> {
    const lines = this.editor.getLines();
    const hlKey = this.computeHlKey(lines);

    if (this.hlCache.has(hlKey)) return;

    const highlighted = await this.tryHighlight(lines.join("\n"));
    if (highlighted) {
      this.hlCache.set(hlKey, highlighted);
      this.requestRender();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const innerWidth = width - 2;
    const contentHeight = this.tui.terminal.rows - 4;
    const result = this.renderEditorContentSync(innerWidth, contentHeight);

    const output = [
      ...this.renderHeader(innerWidth),
      ...this.renderContentRows(result.lines, innerWidth),
      ...this.renderFooter(innerWidth),
    ];

    this.cachedWidth = width;
    this.cachedLines = output;

    void this.updateHighlightCache();

    return output;
  }

  private async renderEditorContent(
    innerWidth: number,
    height: number,
  ): Promise<{ lines: string[] }> {
    const lines = this.editor.getLines();
    const displayLines = await this.resolveDisplayLinesAsync(lines);
    const { cursor, topLine, selection } = this.getEditorState();

    return this.renderWithDisplayLines({
      displayLines,
      innerWidth,
      height,
      cursor,
      topLine,
      selection,
    });
  }

  private renderWithDisplayLines(opts: {
    displayLines: readonly string[];
    innerWidth: number;
    height: number;
    cursor: { line: number; col: number };
    topLine: number;
    selection: {
      start: { line: number; col: number };
      end: { line: number; col: number };
    } | null;
  }): { lines: string[] } {
    const { displayLines, innerWidth, height, cursor, topLine, selection } =
      opts;

    const renderOpts: RenderOptions = {
      lines: [...displayLines],
      width: innerWidth - 1,
      height,
      cursor,
      topLine,
      showCursor: this.focused,
      selection,
    };

    return renderEditorView(this.theme, renderOpts);
  }

  private renderHeader(innerWidth: number): string[] {
    const fileName = basename(this.filePath);
    const titleText = ` Editing: ${fileName}`;
    const titlePadded = pad(titleText, innerWidth);

    return [
      this.theme.fg("borderAccent", BOX.topLeft) +
        this.theme.fg("borderAccent", BOX.horizontal.repeat(innerWidth)) +
        this.theme.fg("borderAccent", BOX.topRight),
      this.theme.fg("borderAccent", BOX.vertical) +
        this.theme.fg("accent", titlePadded) +
        this.theme.fg("borderAccent", BOX.vertical),
      this.theme.fg("borderAccent", BOX.teeLeft) +
        this.theme.fg("borderAccent", BOX.horizontal.repeat(innerWidth)) +
        this.theme.fg("borderAccent", BOX.teeRight),
    ];
  }

  private renderContentRows(
    contentLines: string[],
    innerWidth: number,
  ): string[] {
    const rightBorder = this.theme.fg("border", BOX.vertical);
    return contentLines.map(
      (line) =>
        this.theme.fg("border", BOX.vertical) +
        ensureWidth(line, innerWidth - 2) +
        rightBorder,
    );
  }

  private renderFooter(innerWidth: number): string[] {
    const activeBindings = filterActiveBindings(this.bindings);
    const helpContent = buildHelpFromBindings(activeBindings);
    const helpPrefix = this.theme.fg("dim", " esc quit");
    const fullHelp = helpContent ? `${helpPrefix}  ${helpContent}` : helpPrefix;
    const helpText = formatHelpWithStatus(
      this.theme,
      this.statusState.message,
      fullHelp,
    );
    const helpPadded = pad(` ${helpText}`, innerWidth);

    return [
      this.theme.fg("border", BOX.vertical) +
        helpPadded +
        this.theme.fg("border", BOX.vertical),
      this.theme.fg("border", BOX.bottomLeft) +
        this.theme.fg("border", BOX.horizontal.repeat(innerWidth)) +
        this.theme.fg("border", BOX.bottomRight),
    ];
  }

  handleInput(data: string): void {
    if (this.keyboardHandler(data)) return;

    if (data.includes("\x1b[200~")) {
      const cleaned = data
        .replace(/\x1b\[200~|\x1b\[201~/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
      if (cleaned.length > 0) {
        this.editor.insertText(cleaned);
        this.requestRender();
      }
    }
  }

  private handleCharInput(char: string): void {
    const pairMap: Record<string, [string, string]> = {
      "(": ["(", ")"],
      "[": ["[", "]"],
      "{": ["{", "}"],
    };

    const pair = pairMap[char];
    if (pair) {
      this.editor.insertPair(pair[0], pair[1]);
    } else {
      this.editor.insertChar(char);
    }
    this.requestRender();
  }

  private async saveFile(): Promise<void> {
    try {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(this.opts.filePath, this.editor.getContent());
      this.saved = true;
    } catch {
      // silent
    }
  }

  private async quit(): Promise<void> {
    if (!this.saved && this.opts.filePath) {
      await this.saveFile();
    }
    this.done({ saved: this.saved });
  }

  private get done(): (result: EditorResult | null) => void {
    return this.opts.done;
  }

  dispose(): void {
    this.hlCache.clear();
  }
}
