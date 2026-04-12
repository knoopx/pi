import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerSearchTools } from "./search";
import { registerRepoTools } from "./repo";
import { registerGistTools } from "./gist";
import { registerPRTools } from "./pr";
import { registerIssueTools } from "./issue";
import { registerReleaseTools } from "./release";
import { registerWorkflowTools } from "./workflow";

export default function ghExtension(pi: ExtensionAPI): void {
  registerSearchTools(pi);
  registerRepoTools(pi);
  registerGistTools(pi);
  registerPRTools(pi);
  registerIssueTools(pi);
  registerReleaseTools(pi);
  registerWorkflowTools(pi);
}
