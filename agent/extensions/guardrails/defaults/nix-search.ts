import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "nix-search",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "nix search *",
        action: "block",
        reason:
          "do not run `nix search`. Use the nix-search-packages tool instead",
      },
    ],
  },
];

export default defaults;
