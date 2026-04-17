import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  FindToolDetails,
  FindToolInput,
  GrepToolDetails,
  GrepToolInput,
  LsToolDetails,
  LsToolInput,
  ReadToolDetails,
  ReadToolInput,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";

export interface ToolRenderContext<TState, TArgs> {
  args: TArgs;
  toolCallId: string;
  invalidate: () => void;
  lastComponent: Component | undefined;
  state: TState;
  cwd: string;
  executionStarted: boolean;
  argsComplete: boolean;
  isPartial: boolean;
  expanded: boolean;
  showImages: boolean;
  isError: boolean;
}

type ReadDetails =
  | ReadToolDetails
  | undefined
  | {
      _type: "readImage" | "readFile";
      filePath: string;
      data?: string;
      mimeType?: string;
      content?: string;
      offset?: number;
      lineCount?: number;
    };

type LsDetails =
  | LsToolDetails
  | undefined
  | {
      _type: "lsResult";
      path?: string;
      text?: string;
      entryCount?: number;
    };

type FindDetails =
  | FindToolDetails
  | undefined
  | {
      _type: "findResult";
      text?: string;
      pattern?: string;
      matchCount?: number;
    };

type GrepDetails =
  | GrepToolDetails
  | undefined
  | {
      _type: "grepResult";
      text?: string;
      pattern?: string;
      matchCount?: number;
    };

const MAX_PREVIEW_LINES = 80;
