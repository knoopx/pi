import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "protect-paths",
    pattern: "*",
    rules: [
      {
        context: "file_name",
        pattern: ".git/**",
        action: "block",
        reason:
          "VCS internals — direct modification can corrupt history. Use git/jj commands instead",
      },
      {
        context: "file_name",
        pattern: ".jj/**",
        excludes: ".jj/workspaces/**",
        action: "block",
        reason:
          "VCS internals — direct modification can corrupt history. Use git/jj commands instead",
      },
      {
        context: "command",
        pattern: "{cat,less,head,tail,rm,mv,cp} *",
        includes: "* {*.git/*,*.jj/*} *",
        action: "block",
        reason:
          "VCS internals — direct access can corrupt history. Use git/jj commands instead",
      },
    ],
  },
];

export default defaults;
