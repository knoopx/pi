import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createPullRequestsComponent } from "./component";
import { openBrowserOverlay } from "../../lib/overlay-utils";

export async function openPullRequestsBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await openBrowserOverlay(pi, ctx, createPullRequestsComponent);
}
