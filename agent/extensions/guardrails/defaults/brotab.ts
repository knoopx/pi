import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "brotab",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "brotab close *",
        action: "block",
        reason: "NEVER close user tabs — closing the last tab kills the browser and destroys all open pages. Use 'brotab update' to refresh a tab URL instead.",
      },
    ],
  },
];

export default defaults;
