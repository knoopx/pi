import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "uv",
    pattern: "{pyproject.toml,.venv}",
    rules: [
      {
        context: "command",
        pattern: "{python,python3,pip,pip3} *",
        action: "block",
        reason:
          "this project uses uv. Use uv equivalents: `uv run`, `uv add`, `uv remove`, `uv sync` (read skill: uv)",
      },
    ],
  },
];

export default defaults;
