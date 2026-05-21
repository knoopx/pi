import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "no-root-search",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "find / *",
        action: "block",
        reason:
          "searching from root is slow and wasteful. Search from project directory or known paths (read skill: no-root-search)",
      },
      {
        context: "command",
        pattern: "fd * /",
        action: "block",
        reason:
          "searching from root is slow and wasteful. Search from project directory or known paths (read skill: no-root-search)",
      },
      {
        context: "command",
        pattern: "grep * / *",
        action: "block",
        reason:
          "searching from root is slow and wasteful. Search from project directory or known paths (read skill: no-root-search)",
      },
      {
        context: "command",
        pattern: "rg * / *",
        action: "block",
        reason:
          "searching from root is slow and wasteful. Search from project directory or known paths (read skill: no-root-search)",
      },
      {
        context: "command",
        pattern: "locate *",
        action: "block",
        reason:
          "locate searches the entire filesystem. Use find from known paths instead (read skill: no-root-search)",
      },
    ],
  },
];

export default defaults;
