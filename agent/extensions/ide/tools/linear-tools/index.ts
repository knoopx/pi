/**
 * Linear Tools Index
 *
 * Exports all Linear-related tool registration functions.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerLinearSearch } from "./search.js";
import { registerLinearGetIssue } from "./get-issue.js";
import { registerLinearCreateIssue } from "./create-issue.js";
import { registerLinearUpdateIssue } from "./update-issue.js";

export { registerLinearLoginCommand } from "./login.js";

export function registerLinearTools(pi: ExtensionAPI): void {
  registerLinearSearch(pi);
  registerLinearGetIssue(pi);
  registerLinearCreateIssue(pi);
  registerLinearUpdateIssue(pi);
}
