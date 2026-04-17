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

export default async function piPrettyExtension(
  pi: ExtensionAPI,
): Promise<void> {
  const cwd = process.cwd();
  const home = process.env.HOME ?? "";

  const createReadToolFn = createReadToolDefinition ?? createReadTool;
  if (!createReadToolFn) return;
  const origRead = createReadToolFn(cwd);

  pi.registerTool({
    name: "read",
    label: origRead.label,
    description: origRead.description,
    promptSnippet: origRead.promptSnippet,
    promptGuidelines: origRead.promptGuidelines,
    parameters: origRead.parameters,
    renderShell: origRead.renderShell,
    prepareArguments: origRead.prepareArguments,
    execute: createReadExecute(origRead.execute as any),
    renderCall: createReadRenderCall(cwd, home),
    renderResult: createReadRenderResult(),
  } as any);

  const createLsToolFn = createLsToolDefinition ?? createLsTool;
  if (createLsToolFn) {
    const origLs = createLsToolFn(cwd);
    pi.registerTool({
      name: "ls",
      label: origLs.label,
      description: origLs.description,
      promptSnippet: origLs.promptSnippet,
      promptGuidelines: origLs.promptGuidelines,
      parameters: origLs.parameters,
      renderShell: origLs.renderShell,
      prepareArguments: origLs.prepareArguments,
      execute: createLsExecute(origLs.execute as any),
      renderCall: createLsRenderCall(cwd, home),
      renderResult: createLsRenderResult(),
    } as any);
  }

  const createFindToolFn = createFindToolDefinition ?? createFindTool;
  if (createFindToolFn) {
    const origFind = createFindToolFn(cwd);
    pi.registerTool({
      name: "find",
      label: origFind.label,
      description: origFind.description,
      promptSnippet: origFind.promptSnippet,
      promptGuidelines: origFind.promptGuidelines,
      parameters: origFind.parameters,
      renderShell: origFind.renderShell,
      prepareArguments: origFind.prepareArguments,
      execute: createFindExecute(origFind.execute as any),
      renderCall: createFindRenderCall(cwd, home),
      renderResult: createFindRenderResult(),
    } as any);
  }

  const createGrepToolFn = createGrepToolDefinition ?? createGrepTool;
  if (createGrepToolFn) {
    const origGrep = createGrepToolFn(cwd);
    pi.registerTool({
      name: "grep",
      label: origGrep.label,
      description: origGrep.description,
      promptSnippet: origGrep.promptSnippet,
      promptGuidelines: origGrep.promptGuidelines,
      parameters: origGrep.parameters,
      renderShell: origGrep.renderShell,
      prepareArguments: origGrep.prepareArguments,
      execute: createGrepExecute(origGrep.execute as any),
      renderCall: createGrepRenderCall(cwd, home),
      renderResult: createGrepRenderResult(),
    } as any);
  }
}
