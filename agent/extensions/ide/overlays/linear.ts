/**
 * Linear issues browser overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  createLinearIssuesComponent,
  createLinearIssueForm,
  getLinearApiKey,
  type LinearIssuesResult,
  type IssueFormResult,
} from "../components/linear-issues";
import { FULL_OVERLAY_OPTIONS, CENTERED_OVERLAY_OPTIONS } from "./options";

export async function openLinearIssuesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  const apiKey = getLinearApiKey();

  while (true) {
    const result = await ctx.ui.custom<LinearIssuesResult>(
      (tui, theme, keybindings, done) => {
        return createLinearIssuesComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          ctx.cwd,
          (text) => {
            ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
          },
        );
      },
      FULL_OVERLAY_OPTIONS,
    );

    if (!result.action) {
      break;
    }

    if (!apiKey) {
      ctx.ui.notify("Not logged in to Linear", "error");
      break;
    }

    const formResult = await ctx.ui.custom<IssueFormResult>(
      (tui, theme, keybindings, done) => {
        const issue =
          result.action?.type === "edit" ? result.action.issue : null;
        return createLinearIssueForm(
          pi,
          tui,
          theme,
          keybindings,
          done,
          apiKey,
          issue,
        );
      },
      CENTERED_OVERLAY_OPTIONS,
    );

    if (formResult.action === "saved" && formResult.issue) {
      ctx.ui.notify(`Created ${formResult.issue.identifier}`, "info");
    }
  }
}
