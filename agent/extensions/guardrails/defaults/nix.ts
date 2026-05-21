import type { GuardrailsGroup } from "../types";

const defaults: GuardrailsGroup[] = [
  {
    group: "nix",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "nix ? . *",
        action: "block",
        reason:
          "`.` without `path:` prefix only includes tracked files. Use `path:.` instead (read skill: nix-flakes)",
      },
      {
        context: "command",
        pattern: "{nix-hash,nix-prefetch-url,nix hash} *",
        action: "block",
        reason:
          'Do not pre-compute hashes. Set hash to `""` and let the build report the correct one via `got:` errors (read skill: nix)',
      },
      {
        context: "command",
        pattern: "nix profile {install,add} *",
        action: "block",
        reason:
          "nix profile install/add is forbidden. Use `nix run nixpkgs#<package>` for one-off execution or `nix shell nixpkgs#<package>` for a temporary environment (read skill: nix)",
      },
    ],
  },
];

export default defaults;
