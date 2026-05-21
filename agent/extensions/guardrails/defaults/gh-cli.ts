import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "gh-cli",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern:
          "gh {repo delete,repo archive,repo rename,release delete,issue delete,gist delete,run delete,label delete,secret delete,variable delete} *",
        action: "block",
        reason: "you are not allowed to manage github resources",
      },
    ],
  },
];

export default defaults;
