/**
 * Tools Registration
 *
 * Imports and registers all tools from their respective modules.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import piPrettyExtension from "./pretty";

export async function registerAllTools(pi: ExtensionAPI): Promise<void> {
  // Register pretty tool wrappers for enhanced output
  await piPrettyExtension(pi);
}
