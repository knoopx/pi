import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "use-cm-not-grep",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "grep -rn * --include=* *",
        action: "block",
        reason:
          "do not use grep to search for code symbols. Use `cm query symbol` to find definitions, `cm callers symbol` for reverse dependencies, or `cm map . --format ai` for structure (read skill: cm)",
      },
      {
        context: "command",
        pattern: "grep -r * --include=* *",
        action: "block",
        reason:
          "do not use grep to search for code symbols. Use `cm query symbol` to find definitions, `cm callers symbol` for reverse dependencies, or `cm map . --format ai` for structure (read skill: cm)",
      },
    ],
  },
];

export default defaults;
