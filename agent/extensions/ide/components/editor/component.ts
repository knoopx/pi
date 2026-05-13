import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, Focusable, TUI } from "@earendil-works/pi-tui";

import {
  createKeyboardHandler,
  type KeyBinding,
} from "../../lib/keyboard/handler";
import { Editor } from "./core/editor";
import { buildBindings } from "./bindings";
import {
  renderHeader,
  renderContentRows,
  renderFooter,
  computeHlKey,
  tryHighlight,
  renderWithDisplayLines as renderWithDisplayLinesFn,
} from "./layout";
import {
  createStatusNotifier,
  type StatusMessageState,
} from "../../lib/ui/status";

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

    this.bindings = buildBindings(this.editor, () => this.requestRender());
    this.opts.tui.setFocus(this);
    this.keyboardHandler = createKeyboardHandler({
      bindings: this.bindings,
      getContext: () => this as never,
      onEscape: () => {
        void this.quit();
      },
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

    void this.updateHighlightCache();
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
    const hlKey = computeHlKey(this.filePath, lines);
    const cached = this.getCachedDisplayLines(hlKey);
    if (cached) return cached;
    return lines;
  }

  private async resolveDisplayLinesAsync(
    lines: readonly string[],
  ): Promise<readonly string[]> {
    const hlKey = computeHlKey(this.filePath, lines);
    const cached = this.getCachedDisplayLines(hlKey);
    if (cached) return cached;
    const highlighted = await tryHighlight(this.filePath, lines.join("\n"));
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

    return renderWithDisplayLinesFn(this.theme, {
      displayLines,
      innerWidth,
      height,
      cursor,
      topLine,
      showCursor: this.focused,
      selection,
    });
  }

  private async updateHighlightCache(): Promise<void> {
    const lines = this.editor.getLines();
    const hlKey = computeHlKey(this.filePath, lines);

    if (this.hlCache.has(hlKey)) return;
    const highlighted = await tryHighlight(this.filePath, lines.join("\n"));
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
      ...renderHeader(this.theme, this.filePath, innerWidth),
      ...renderContentRows(this.theme, result.lines, innerWidth),
      ...renderFooter(this.theme, this.statusState, this.bindings, innerWidth),
    ];

    this.cachedWidth = width;
    this.cachedLines = output;

    return output;
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
    } catch {}
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
