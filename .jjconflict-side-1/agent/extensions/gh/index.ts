import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerSearchTools } from "./search";
import { registerRepoTools } from "./repo";
import { registerGistTools } from "./gist";
import { registerPRTools } from "./pr";
import { registerIssueTools } from "./issue";
import { registerReleaseTools } from "./release";
import { registerWorkflowTools } from "./workflow";

export * from "./search";
export * from "./repo";
export * from "./gist";
export * from "./pr";
export * from "./issue";
export * from "./release";
export * from "./workflow";
export * from "./types";
export * from "./utils";

export default function ghExtension(pi: ExtensionAPI) {
  registerSearchTools(pi);
  registerRepoTools(pi);
  registerGistTools(pi);
  registerPRTools(pi);
  registerIssueTools(pi);
  registerReleaseTools(pi);
  registerWorkflowTools(pi);
}
