import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Input, matchesKey } from "@mariozechner/pi-tui";
import { buildHelpText, ensureWidth, truncateAnsi } from "./text-utils";
import { createKeyboardHandler } from "../keyboard";
import {
  borderedLine,
  topBorderWithTitle,
  horizontalSeparator,
  bottomBorder,
  renderFormFieldContent,
  renderFormFooter,
} from "./shared-utils";
import { linearGraphQL } from "../api/linear";
import type { LinearIssue } from "./linear-issues";

interface LinearState {
  id: string;
  name: string;
  type: string;
}

interface StatesQueryData {
  workflowStates: { nodes: LinearState[] };
}

interface UpdateIssueData {
  issueUpdate: {
    success: boolean;
    issue: { id: string } | null;
  };
}

interface CreateIssueData {
  issueCreate: {
    success: boolean;
    issue: { id: string; identifier: string; url: string } | null;
  };
}

interface TeamsQueryData {
  teams: { nodes: { id: string; key: string; name: string }[] };
}

const PRIORITIES = [
  { value: 0, label: "No priority" },
  { value: 1, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 3, label: "Normal" },
  { value: 4, label: "Low" },
];

type FormField = "title" | "description" | "state" | "priority";
const FORM_FIELDS: FormField[] = ["title", "description", "state", "priority"];

export interface IssueFormResult {
  action: "saved" | "cancelled";
  issue?: { identifier: string; url: string };
}

export function createLinearIssueForm(
  _pi: ExtensionAPI,
  tui: { requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: IssueFormResult) => void,
  apiKey: string,
  issue: LinearIssue | null,
  defaultTeamId?: string,
) {
  const isCreate = issue === null;

  const titleInput = new Input();
  titleInput.setValue(issue?.title ?? "");

  const descInput = new Input();
  descInput.setValue(issue?.description ?? "");

  let focusedField: FormField = "title";
  let states: LinearState[] = [];
  let selectedStateIndex = 0;
  let selectedPriorityIndex = issue
    ? PRIORITIES.findIndex((p) => p.value === issue.priority)
    : 3;
  if (selectedPriorityIndex < 0) selectedPriorityIndex = 0;

  let loading = true;
  let saving = false;
  let error: string | null = null;
  let teamId = defaultTeamId ?? "";

  async function loadData(): Promise<void> {
    try {
      loading = true;
      error = null;
      tui.requestRender();

      // Fetch workflow states
      const statesQuery = `
        query IdeLinearStates {
          workflowStates {
            nodes {
              id
              name
              type
            }
          }
        }
      `;

      const statesData = await linearGraphQL<StatesQueryData>(apiKey, {
        query: statesQuery,
      });
      states = statesData.workflowStates.nodes;

      // Find current state index
      if (issue) {
        const idx = states.findIndex((s) => s.name === issue.stateName);
        if (idx >= 0) selectedStateIndex = idx;
      }

      // If creating, fetch teams to get default team
      if (isCreate && !teamId) {
        const teamsQuery = `
          query IdeLinearTeams {
            teams {
              nodes {
                id
                key
                name
              }
            }
          }
        `;
        const teamsData = await linearGraphQL<TeamsQueryData>(apiKey, {
          query: teamsQuery,
        });
        if (teamsData.teams.nodes.length > 0) {
          teamId = teamsData.teams.nodes[0].id;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
      tui.requestRender();
    }
  }

  async function saveIssue(): Promise<void> {
    const title = titleInput.getValue().trim();
    if (!title) {
      error = "Title is required";
      tui.requestRender();
      return;
    }

    saving = true;
    error = null;
    tui.requestRender();

    try {
      if (isCreate) {
        if (!teamId) {
          throw new Error("No team available");
        }

        const mutation = `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                url
              }
            }
          }
        `;

        const input: Record<string, unknown> = {
          teamId,
          title,
          description: descInput.getValue() || undefined,
          priority: PRIORITIES[selectedPriorityIndex].value,
        };

        if (states[selectedStateIndex]) {
          input.stateId = states[selectedStateIndex].id;
        }

        const data = await linearGraphQL<CreateIssueData>(apiKey, {
          query: mutation,
          variables: { input },
        });

        if (!data.issueCreate.success || !data.issueCreate.issue) {
          throw new Error("Failed to create issue");
        }

        done({
          action: "saved",
          issue: {
            identifier: data.issueCreate.issue.identifier,
            url: data.issueCreate.issue.url,
          },
        });
      } else {
        const mutation = `
          mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue {
                id
              }
            }
          }
        `;

        const input: Record<string, unknown> = {
          title,
          description: descInput.getValue(),
          priority: PRIORITIES[selectedPriorityIndex].value,
        };

        if (states[selectedStateIndex]) {
          input.stateId = states[selectedStateIndex].id;
        }

        const data = await linearGraphQL<UpdateIssueData>(apiKey, {
          query: mutation,
          variables: { id: issue.id, input },
        });

        if (!data.issueUpdate.success) {
          throw new Error("Failed to update issue");
        }

        done({ action: "saved" });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      saving = false;
      tui.requestRender();
    }
  }

  function getCurrentInput(): Input | null {
    if (focusedField === "title") return titleInput;
    if (focusedField === "description") return descInput;
    return null;
  }

  function renderField(
    label: string,
    value: string,
    isFocused: boolean,
    innerWidth: number,
    isSelector = false,
  ): string {
    const labelWidth = 12;
    const labelText = ensureWidth(` ${label}:`, labelWidth);
    const valueWidth = innerWidth - labelWidth - 2;

    let valueText = truncateAnsi(value || "(empty)", valueWidth);
    if (isFocused && !isSelector) {
      valueText = value + theme.fg("accent", "▏");
      valueText = truncateAnsi(valueText, valueWidth);
    }

    return renderFormFieldContent(
      theme,
      labelText,
      valueText,
      isFocused,
      innerWidth,
    );
  }

  function render(width: number): string[] {
    const lines: string[] = [];
    const innerWidth = width - 2;
    const title = isCreate ? " New Issue " : ` Edit ${issue?.identifier} `;

    lines.push(topBorderWithTitle(theme, title, innerWidth));

    if (loading || saving) {
      const msg = loading ? "Loading..." : "Saving...";
      lines.push(borderedLine(theme, theme.fg("dim", ` ${msg}`), innerWidth));
      // Pad to consistent height (4 fields + separator + help + footer = 7 lines after header)
      for (let i = 0; i < 6; i++) {
        lines.push(borderedLine(theme, "", innerWidth));
      }
      lines.push(bottomBorder(theme, innerWidth));
      return lines;
    }

    // Title field
    lines.push(
      borderedLine(
        theme,
        renderField(
          "Title",
          titleInput.getValue(),
          focusedField === "title",
          innerWidth,
        ),
        innerWidth,
      ),
    );

    // Description field
    lines.push(
      borderedLine(
        theme,
        renderField(
          "Description",
          descInput.getValue(),
          focusedField === "description",
          innerWidth,
        ),
        innerWidth,
      ),
    );

    // State selector
    const stateValue = states[selectedStateIndex]?.name ?? "(loading)";
    const stateHint =
      focusedField === "state" ? `← ${stateValue} →` : stateValue;
    lines.push(
      borderedLine(
        theme,
        renderField(
          "State",
          stateHint,
          focusedField === "state",
          innerWidth,
          true,
        ),
        innerWidth,
      ),
    );

    // Priority selector
    const priorityValue = PRIORITIES[selectedPriorityIndex]?.label ?? "Normal";
    const priorityHint =
      focusedField === "priority" ? `← ${priorityValue} →` : priorityValue;
    lines.push(
      borderedLine(
        theme,
        renderField(
          "Priority",
          priorityHint,
          focusedField === "priority",
          innerWidth,
          true,
        ),
        innerWidth,
      ),
    );

    // Error or empty line for consistent height
    lines.push(horizontalSeparator(theme, innerWidth));
    if (error) {
      lines.push(
        borderedLine(theme, theme.fg("error", ` ${error}`), innerWidth),
      );
    } else {
      lines.push(borderedLine(theme, "", innerWidth));
    }

    // Help
    const helpParts =
      focusedField === "state" || focusedField === "priority"
        ? ["←→ change", "↑↓ field", "enter save", "esc cancel"]
        : ["↑↓ field", "enter save", "esc cancel"];
    lines.push(...renderFormFooter(theme, innerWidth, ...helpParts));

    return lines;
  }

  const handleKeyboard = createKeyboardHandler({
    bindings: [
      {
        key: "tab",
        handler: () => {
          const idx = FORM_FIELDS.indexOf(focusedField);
          if (idx < FORM_FIELDS.length - 1) {
            focusedField = FORM_FIELDS[idx + 1];
            tui.requestRender();
          }
        },
      },
      {
        key: "left",
        handler: () => {
          if (focusedField === "state" && states.length > 0) {
            selectedStateIndex =
              (selectedStateIndex - 1 + states.length) % states.length;
            tui.requestRender();
            return true;
          }
          if (focusedField === "priority") {
            selectedPriorityIndex =
              (selectedPriorityIndex - 1 + PRIORITIES.length) %
              PRIORITIES.length;
            tui.requestRender();
            return true;
          }
          return false;
        },
      },
      {
        key: "right",
        handler: () => {
          if (focusedField === "state" && states.length > 0) {
            selectedStateIndex = (selectedStateIndex + 1) % states.length;
            tui.requestRender();
            return true;
          }
          if (focusedField === "priority") {
            selectedPriorityIndex =
              (selectedPriorityIndex + 1) % PRIORITIES.length;
            tui.requestRender();
            return true;
          }
          return false;
        },
      },
    ],
    navigation: () => ({
      index: FORM_FIELDS.indexOf(focusedField),
      maxIndex: FORM_FIELDS.length - 1,
    }),
    onNavigate: (newIndex) => {
      focusedField = FORM_FIELDS[newIndex];
      tui.requestRender();
    },
    onEscape: () => done({ action: "cancelled" }),
    onEnter: () => void saveIssue(),
  });

  function handleInput(data: string): void {
    if (handleKeyboard(data)) {
      return;
    }

    // Text input for title/description
    const input = getCurrentInput();
    if (input) {
      input.handleInput(data);
      tui.requestRender();
    }
  }

  void loadData();

  return {
    render,
    handleInput,
    invalidate() {
      titleInput.invalidate();
      descInput.invalidate();
    },
    dispose() {},
  };
}
