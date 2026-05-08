import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piPrettyExtension from "./pretty";
export function registerAllTools(pi: ExtensionAPI): void {
  piPrettyExtension(pi);
}
