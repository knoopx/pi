import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "podman",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "{docker,docker-compose} *",
        action: "block",
        reason: "use Podman instead of Docker (read skill: podman)",
      },
    ],
  },
];

export default defaults;
