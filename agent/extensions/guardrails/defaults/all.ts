import type { GuardrailsGroup } from "../types";
import brotabDefaults from "./brotab";
import nixSearchDefaults from "./nix-search";
import noNpmDefaults from "./no-npm";
import vitestDefaults from "./vitest";
import uvDefaults from "./uv";
import nixDefaults from "./nix";
import protectPathsDefaults from "./protect-paths";
import permissionGateDefaults from "./permission-gate";
import lockFilesDefaults from "./lock-files";
import testingDefaults from "./testing";
import lintingDefaults from "./linting";
import interactiveDefaults from "./interactive";
import podmanDefaults from "./podman";
import typescriptOnlyDefaults from "./typescript-only";
import ghCliDefaults from "./gh-cli";
import noRootSearchDefaults from "./no-root-search";
import useCmNotGrepDefaults from "./use-cm-not-grep";
import jjDefaults from "./jj";
import sourceEditingDefaults from "./source-editing";

const defaults: GuardrailsGroup[] = [
  ...brotabDefaults,
  ...nixSearchDefaults,
  ...noNpmDefaults,
  ...vitestDefaults,
  ...uvDefaults,
  ...nixDefaults,
  ...protectPathsDefaults,
  ...permissionGateDefaults,
  ...lockFilesDefaults,
  ...testingDefaults,
  ...lintingDefaults,
  ...interactiveDefaults,
  ...podmanDefaults,
  ...typescriptOnlyDefaults,
  ...ghCliDefaults,
  ...noRootSearchDefaults,
  ...useCmNotGrepDefaults,
  ...jjDefaults,
  ...sourceEditingDefaults,
];

export default defaults;
