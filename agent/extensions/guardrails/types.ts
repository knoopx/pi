export interface GuardrailsRule {
  context: "command" | "file_name" | "file_content";

  pattern: string;

  file_pattern?: string;
  includes?: string;

  excludes?: string;

  scope?: "project" | "external";
  action: "block" | "confirm";
  reason: string;
}
export interface GuardrailsGroup {
  group: string;

  pattern: string;

  excludePattern?: string;
  rules: GuardrailsRule[];
}
