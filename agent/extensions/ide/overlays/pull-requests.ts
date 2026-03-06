/**
 * Pull requests browser overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createPullRequestsComponent } from "../components/pull-requests";
import { openBrowserOverlay } from "./open-browser-overlay";

export async function openPullRequestsBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await openBrowserOverlay(pi, ctx, createPullRequestsComponent);
}
