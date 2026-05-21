import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "lock-files",
    pattern: "*",
    rules: [
      {
        context: "file_name",
        pattern:
          "{package-lock.json,bun.lockb,yarn.lock,pnpm-lock.yaml,poetry.lock,uv.lock,Cargo.lock,Gemfile.lock,flake.lock}",
        action: "block",
        reason:
          "lock files are auto-generated. Edit the manifest instead and run the package manager to regenerate",
      },
    ],
  },
];

export default defaults;
