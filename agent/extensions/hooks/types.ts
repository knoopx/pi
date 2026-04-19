import type { HookOutput } from "./schema";

export interface HookVariables {
  file?: string;
  tool?: string;
  cwd: string;
}

export interface HookResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  output: HookOutput | undefined;
  group: string;
  command: string;
}

export interface HookProcessState {
  results: HookResult[];
  additionalContexts: string[];
}
