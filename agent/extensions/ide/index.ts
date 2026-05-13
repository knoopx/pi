import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerAllTools from "./tools/pretty/registration";
import { handleSessionStart, handleModelSelect } from "./commands/handlers";
import { handleSessionFork } from "./workspace/handlers";
import { registerShortcuts } from "./commands/shortcuts";
import { registerCommands } from "./commands/registration";
import { promptAndSetBookmark } from "./components/bookmark-prompt/prompt";

export default function ideExtension(pi: ExtensionAPI): void {
  const onBookmark = promptAndSetBookmark(pi);

  pi.on("session_start", (_event, ctx) => {
    handleSessionStart(pi, ctx);
  });
  pi.on("model_select", (_event, ctx) => {
    handleModelSelect(pi, ctx);
  });
  pi.on("session_before_fork", (_event, ctx) => {
    handleSessionFork(pi, _event, ctx);
  });

  registerShortcuts(pi, onBookmark);
  registerCommands(pi, onBookmark);
  registerAllTools(pi);
}
