import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Eta } from "eta";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ChangesState } from "../state";
import { getSelectedChanges } from "../state-utils";
import { getRepoRoot } from "../../../jj/files";

const TEMPLATES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "templates",
);

const eta = new Eta({ useWith: true });

function loadTemplate(name: string): string {
  return readFileSync(resolve(TEMPLATES_DIR, name), "utf-8").trim();
}

function render(template: string, data: Record<string, unknown>): string {
  return eta.renderString(template, data);
}

interface DescribeContext {
  pi: ExtensionAPI;
  cwd: string;
  state: ChangesState;
  finish: () => void;
}

export async function describeChanges(ctx: DescribeContext): Promise<void> {
  const selectedChanges = getSelectedChanges(ctx.state);
  if (selectedChanges.length === 0) return;

  ctx.finish();
  const changeIds = selectedChanges.map((target) => target.changeId);
  const repoRoot = await getRepoRoot(ctx.pi, ctx.cwd);
  const tpl = loadTemplate("describe.txt");
  const task = render(tpl, {
    ids: changeIds.join(", "),
    changeIds,
    cwd: ctx.cwd,
    repoRoot,
  });
  ctx.pi.sendUserMessage(task);
}

export function inspectChange(ctx: DescribeContext): void {
  if (!ctx.state.selectedChange) return;
  ctx.finish();
  const tpl = loadTemplate("inspect.txt");
  const task = render(tpl, { changeId: ctx.state.selectedChange.changeId });
  ctx.pi.sendUserMessage(task);
}

export async function splitChange(ctx: DescribeContext): Promise<void> {
  if (!ctx.state.selectedChange) return;
  ctx.finish();
  const repoRoot = await getRepoRoot(ctx.pi, ctx.cwd);
  const tpl = loadTemplate("split.txt");
  const task = render(tpl, {
    changeId: ctx.state.selectedChange.changeId,
    cwd: ctx.cwd,
    repoRoot,
  });
  ctx.pi.sendUserMessage(task);
}
