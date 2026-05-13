import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerRepoTools } from "./tools/repo";
import { registerGistTools } from "./tools/gist";
import { registerPRTools } from "./tools/pr";
import { registerIssueTools } from "./tools/issue";
import { registerReleaseTools } from "./tools/release";
import { registerWorkflowTools } from "./tools/workflow";
export default function ghExtension(pi: ExtensionAPI): void {
  registerRepoTools(pi);
  registerGistTools(pi);
  registerPRTools(pi);
  registerIssueTools(pi);
  registerReleaseTools(pi);
  registerWorkflowTools(pi);
}
