/**
 * Bookmarks browser overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createBookmarksComponent } from "../components/bookmarks";
import { openBrowserOverlay } from "./open-browser-overlay";

export async function openBookmarksBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await openBrowserOverlay(pi, ctx, createBookmarksComponent);
}
