import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createBookmarksComponent } from "./component";
import { openBrowserOverlay } from "../../lib/overlay-utils";
export async function openBookmarksBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await openBrowserOverlay(pi, ctx, createBookmarksComponent);
}
