import {
  createReadToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createReadTool,
  createLsTool,
  createFindTool,
  createGrepTool,
} from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import type { Component } from "@mariozechner/pi-tui";
import type { ToolExecuteFn } from "./utils";

import {
  createReadExecute,
  createReadRenderCall,
  createReadRenderResult,
} from "./read";
import {
  createLsExecute,
  createLsRenderCall,
  createLsRenderResult,
} from "./ls";
import {
  createFindExecute,
  createFindRenderCall,
  createFindRenderResult,
} from "./find";
import {
  createGrepExecute,
  createGrepRenderCall,
  createGrepRenderResult,
} from "./grep";

interface ToolDefinition {
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines?: string[];
  parameters: unknown;
  renderShell: unknown;
  prepareArguments: unknown;
  execute: ToolExecuteFn;
}

interface ToolRegistryEntry {
  name: string;
  createOrigFn: (cwd: string) => unknown;
  wrapExecute: (
    orig: ToolExecuteFn,
  ) => (...args: unknown[]) => Promise<unknown>;
  createRenderCall: (
    cwd: string,
    home: string,
  ) => (...args: unknown[]) => Component;
  createRenderResult: () => (...args: unknown[]) => Component;
}

function registerTool(
  pi: ExtensionAPI,
  entry: ToolRegistryEntry,
  cwd: string,
): void {
  const orig = entry.createOrigFn(cwd) as ToolDefinition;
  pi.registerTool({
    name: entry.name,
    label: orig.label,
    description: orig.description,
    promptSnippet: orig.promptSnippet,
    promptGuidelines: orig.promptGuidelines,
    parameters: orig.parameters,
    renderShell: orig.renderShell,
    prepareArguments: orig.prepareArguments,
    execute: entry.wrapExecute(orig.execute),
    renderCall: entry.createRenderCall(cwd, process.env.HOME ?? ""),
    renderResult: entry.createRenderResult(),
  } as unknown as Parameters<typeof pi.registerTool>[0]);
}

const TOOL_REGISTRY = [
  {
    name: "read",
    createOrigFn: createReadToolDefinition ?? createReadTool,
    wrapExecute: createReadExecute,
    createRenderCall: createReadRenderCall,
    createRenderResult: createReadRenderResult,
  },
  {
    name: "ls",
    createOrigFn: createLsToolDefinition ?? createLsTool,
    wrapExecute: createLsExecute,
    createRenderCall: createLsRenderCall,
    createRenderResult: createLsRenderResult,
  },
  {
    name: "find",
    createOrigFn: createFindToolDefinition ?? createFindTool,
    wrapExecute: createFindExecute,
    createRenderCall: createFindRenderCall,
    createRenderResult: createFindRenderResult,
  },
  {
    name: "grep",
    createOrigFn: createGrepToolDefinition ?? createGrepTool,
    wrapExecute: createGrepExecute,
    createRenderCall: createGrepRenderCall,
    createRenderResult: createGrepRenderResult,
  },
] as ToolRegistryEntry[];

export default function piPrettyExtension(pi: ExtensionAPI): void {
  const cwd = process.cwd();
  for (const entry of TOOL_REGISTRY) {
    if (!entry.createOrigFn) continue;
    registerTool(pi, entry, cwd);
  }
}
