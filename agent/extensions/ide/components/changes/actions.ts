import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ChangesState } from "./state";
import { notifyMutation } from "../../jj";
import type { Change } from "../../types";

export function createActionHandlers(
  pi: ExtensionAPI,
  cwd: string,
  state: ChangesState,
  finish: () => void,
  refreshAfterMutation: () => Promise<void>,
  restoreSelection: (prevIndex: number) => Promise<void>,
  loadFilesAndDiff: (change: Change) => Promise<void>,
  notify: (msg: string, type?: string) => void,
  onBookmark?: (changeId: string) => Promise<string | null>,
  onFileCmAction?: (
    path: string,
    action: "inspect" | "deps" | "used-by",
  ) => void,
) {
  async function handleDescribe() {
    const selectedChangeIds = getSelectedChanges();
    if (selectedChangeIds.length === 0) return;

    finish();
    const ids = selectedChangeIds.map((target) => target.changeId);

    const workflowLines = ids
      .map((id, index) => {
        return `${String(index + 1)}. Get git hash: \`jj log -r ${id} -T 'commit_id' --no-graph\`\n   Check semantic changes: \`sem diff --commit <hash-from-step-1>\` (use the hash, NOT parent!)\n   Check changed files: \`jj diff --name-only -r ${id}\`\n   If needed for context, inspect patch: \`jj diff --git --color never -r ${id}\`\n   Describe: \`jj desc -r ${id} -m "<type>(<scope>): <description>"\``;
      })
      .join("\n");

    const task = `Describe jujutsu changes ${ids.join(", ")} using Conventional Commits format.

Use the **conventional-commits** skill for type/scope rules.
Use the **sem** skill to understand actual code changes vs cosmetic modifications.

<format>
\`<type>(<scope>): <description>\`

**Scope is required** - always include a scope in parentheses.

Examples:
- \`feat(auth): add passwordless login\`
- \`fix(api): handle empty pagination cursor\`
- \`chore(deps): bump react to 18.3.0\`

Type selection:
- Users see new behavior → \`feat\`
- Users see corrected behavior → \`fix\`
- Otherwise → \`chore\` or more specific type (\`refactor\`, \`build\`, \`ci\`, \`test\`, \`docs\`, \`perf\`, \`style\`)

Scope guidelines:
- Use a short noun: \`api\`, \`auth\`, \`ui\`, \`db\`, \`cli\`, \`deps\`, \`docs\`, \`agent\`, \`lint\`, \`build\`
- Use repo/module/package name when working in a monorepo
- If unsure, use a generic scope like \`core\`, \`general\`, or \`misc\`

Description guidelines:
- Use imperative mood: "add", "fix", "remove", "update"
- No ending punctuation
- Be specific; avoid "changes", "stuff", "update things"
- Describe actual content, not generic categories. Name what was added/changed, not that "rules" or "principles" were added.

Bad examples (vague, generic):
- "add behavioral guidelines and core principles"
- "add agent operating principles"
- "add behavior rules"

Good examples (specific, concrete):
- "add rules for dead code removal, build verification, security, debugging, architecture, and tool usage"
</format>

<sem-guidance>
- If sem shows all changes are \`~\` (cosmetic) → use \`style:\` or \`format:\`
- If sem shows \`∆\` (modified) → describe the actual behavior change
- If sem shows \`+\` or \`-\` → describe additions/removals
- Large file counts don't always mean large changes — sem reveals the truth
</sem-guidance>

<workflow>
${workflowLines}
</workflow>`;
    pi.sendUserMessage(task);
  }

  async function handleEdit(): Promise<void> {
    if (!state.selectedChange) return;
    const editResult = await pi.exec(
      "jj",
      ["edit", state.selectedChange.changeId],
      { cwd },
    );
    await refreshAfterMutation();
    notifyMutation(
      pi,
      `Set working copy to change ${state.selectedChange.changeId.slice(0, 8)}`,
      editResult.stderr || editResult.stdout,
    );
  }

  async function handleSplit(): Promise<void> {
    if (!state.selectedChange) return;
    finish();
    const task = `Split jujutsu change ${state.selectedChange.changeId} into semantically logical commits.

<workflow>
1. Get git hash: \`jj log -r ${state.selectedChange.changeId} -T 'commit_id' --no-graph\`
2. Check semantic changes: \`sem diff --commit <hash-from-step-1>\` (use the hash, NOT parent!)
3. List changed files: \`jj diff --name-only -r ${state.selectedChange.changeId}\`
4. Identify logical groupings by domain/purpose using sem output
5. Split iteratively:
   - First split: \`jj split -r ${state.selectedChange.changeId} --insert-after ${state.selectedChange.changeId} "<file-pattern>" -m "type(scope): description"\`
   - This creates a new child commit with the selected files; note its change ID (shown in output)
   - Subsequent splits: \`jj split -r ${state.selectedChange.changeId} --insert-after <new-commit-change-id-from-previous-split> "<file-pattern>" -m "type(scope): description"\`
   - Each iteration extracts more files from the original change, inserting the new commit after the previous split's result
   - Continue until all logical groupings are separated
6. Update remaining change description: \`jj desc -r ${state.selectedChange.changeId} -m "type(scope): description"\`
</workflow>

<split-explanation>
- The original change (${state.selectedChange.changeId}) remains in place with remaining files
- Each split extracts selected files into a new commit
- --insert-after specifies where to place the new commit in the history
- For iterative splitting, each new commit is inserted after the previous one, creating a chain:
  \`original --insert-after original -> new1 --insert-after new1 -> new2 --insert-after new2 -> new3...\`
- Always use the change ID from the most recent split as the --insert-after target for the next split
- **Important**: Split files sequentially, one at a time, waiting for each split to complete before starting the next. Each split modifies the original commit, so running splits out of order or in parallel can introduce merge conflicts.
</split-explanation>

<sem-guidance>
- Use sem to identify actual behavioral changes vs cosmetic modifications
- Group files by semantic entities (functions, classes, types) that were changed
- If sem shows all changes are \`~\` (cosmetic), consider keeping as a single style/format commit
- Split commits by semantic boundaries, not just file boundaries
- Large file counts don't always mean large changes — sem reveals the truth
</sem-guidance>

Use the **conventional-commits** skill for commit message format.
Use the **sem** skill to understand actual code changes vs cosmetic modifications.`;
    pi.sendUserMessage(task);
  }

  async function handleSquash(): Promise<void> {
    if (!state.selectedChange) return;
    const prevIndex = state.selectionState.selectedIndex;
    const originalChangeId = state.selectedChange.changeId;
    const parentChangeId = state.selectedChange.parentIds?.[0]?.slice(0, 8);
    const squashResult = await pi.exec(
      "jj",
      ["squash", "-u", "-r", originalChangeId],
      { cwd },
    );
    await refreshAfterMutation();
    await restoreSelection(prevIndex);
    if (state.selectedChange) {
      await loadFilesAndDiff(state.selectedChange);
    }
    const msg = parentChangeId
      ? `Squashed change ${originalChangeId.slice(0, 8)} into change ${parentChangeId}`
      : `Squashed change ${originalChangeId.slice(0, 8)}`;
    notifyMutation(pi, msg, squashResult.stderr || squashResult.stdout);
  }

  async function handleDrop(): Promise<void> {
    if (!state.selectedChange) return;
    const prevIndex = state.selectionState.selectedIndex;
    const originalChangeId = state.selectedChange.changeId;
    const dropResult = await pi.exec("jj", ["abandon", originalChangeId], {
      cwd,
    });
    state.selectedChangeIds.delete(originalChangeId);
    await refreshAfterMutation();
    await restoreSelection(prevIndex);
    if (state.selectedChange) {
      await loadFilesAndDiff(state.selectedChange);
    }
    notifyMutation(
      pi,
      `Dropped change ${originalChangeId}`,
      dropResult.stderr || dropResult.stdout,
    );
  }

  async function handleNew(): Promise<void> {
    if (!state.selectedChange) return;
    const newResult = await pi.exec(
      "jj",
      ["new", state.selectedChange.changeId],
      { cwd },
    );
    await refreshAfterMutation();
    const msg = state.currentChangeId
      ? `Created change ${state.currentChangeId} from change ${state.selectedChange.changeId.slice(0, 8)}`
      : `Started a child change from change ${state.selectedChange.changeId.slice(0, 8)}`;
    notifyMutation(pi, msg, newResult.stderr || newResult.stdout);
  }

  async function handleRevert(): Promise<void> {
    if (!state.selectedChange) return;
    const revertResult = await pi.exec(
      "jj",
      ["revert", "-r", state.selectedChange.changeId, "--insert-after", "@"],
      { cwd },
    );
    await refreshAfterMutation();
    notifyMutation(
      pi,
      `Reverted change ${state.selectedChange.changeId.slice(0, 8)}`,
      revertResult.stderr || revertResult.stdout,
    );
  }

  async function handleInspectChange(): Promise<void> {
    if (!state.selectedChange) return;
    finish();
    const task = `Review the jujutsu change ${state.selectedChange.changeId} using entity-level code analysis.

<workflow>
1. Get git hash: \`jj log -r ${state.selectedChange.changeId} -T 'commit_id' --no-graph\`
2. Run inspect diff: \`inspect diff --format markdown <hash-from-step-1>\`
3. Analyze the entity-level review output (risk scores, changed entities, blast radius)
4. Address all issues found by inspect
</workflow>`;
    pi.sendUserMessage(task);
  }

  function getSelectedChanges(): Change[] {
    if (state.selectedChangeIds.size > 0)
      return state.changes.filter((c) =>
        state.selectedChangeIds.has(c.changeId),
      );
    return state.selectedChange ? [state.selectedChange] : [];
  }

  return {
    handleDescribe,
    handleEdit,
    handleSplit,
    handleSquash,
    handleDrop,
    handleNew,
    handleRevert,
    handleInspectChange,
    getSelectedChanges,
  };
}
