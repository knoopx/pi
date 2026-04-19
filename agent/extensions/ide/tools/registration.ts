import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import piPrettyExtension from "./pretty";

export function registerAllTools(pi: ExtensionAPI): void {
  // Register pretty tool wrappers for enhanced output
  piPrettyExtension(pi);
}
