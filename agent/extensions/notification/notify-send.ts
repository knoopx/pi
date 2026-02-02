import type {
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";

export type NotifyToolParams = {
  summary: string;
  body?: string;
  urgency?: "low" | "normal" | "critical";
  expireTime?: number;
  appName?: string;
  icon?: string;
  category?: string;
};

export function buildNotifySendArgs(params: NotifyToolParams): string[] {
  const args: string[] = [];

  if (params.urgency) {
    args.push("-u", params.urgency);
  }

  if (params.expireTime !== undefined) {
    args.push("-t", String(params.expireTime));
  }

  if (params.appName) {
    args.push("-a", params.appName);
  }

  if (params.icon) {
    args.push("-i", params.icon);
  }

  if (params.category) {
    args.push("-c", params.category);
  }

  args.push(params.summary);

  if (params.body) {
    args.push(params.body);
  }

  return args;
}

function isAbortSignal(value: unknown): value is AbortSignal {
  if (!value || typeof value !== "object") return false;
  return (
    "aborted" in value &&
    typeof (value as { addEventListener?: unknown }).addEventListener ===
      "function"
  );
}

function isExtensionContext(value: unknown): value is ExtensionContext {
  if (!value || typeof value !== "object") return false;
  return (
    typeof (value as { cwd?: unknown }).cwd === "string" &&
    typeof (value as { abort?: unknown }).abort === "function"
  );
}

export function normalizeToolExecuteArgs(
  arg1: unknown,
  arg2: unknown,
  arg3: unknown,
): {
  ctx: ExtensionContext;
  onUpdate?: AgentToolUpdateCallback<unknown>;
  signal?: AbortSignal;
} {
  const values = [arg1, arg2, arg3];

  const ctx = values.find(isExtensionContext);
  if (!ctx) {
    throw new Error("Notification tool: extension context not provided");
  }

  const signal = values.find(isAbortSignal);
  const onUpdate = values.find((value) => typeof value === "function") as
    | AgentToolUpdateCallback<unknown>
    | undefined;

  return { ctx, onUpdate, signal };
}
