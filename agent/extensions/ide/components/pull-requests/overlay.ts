import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createPullRequestsComponent } from "./component";
import { openBrowserOverlay } from "../../lib/ui/overlay";
export async function openPullRequestsBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await openBrowserOverlay(pi, ctx, createPullRequestsComponent);
}
