import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "permission-gate",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "sudo *",
        action: "confirm",
        reason: "elevated privileges. Verify root access is needed",
      },
      {
        context: "command",
        pattern: "{dd,mkfs.*} *",
        action: "confirm",
        reason: "destructive disk operation. Verify the target device",
      },
      {
        context: "command",
        pattern: "{chmod,chown} * {777,-R} *",
        action: "confirm",
        reason:
          "recursive or permissive permission change. Verify the path and mode",
      },
    ],
  },
];

export default defaults;
