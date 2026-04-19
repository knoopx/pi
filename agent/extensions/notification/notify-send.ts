interface NotifyToolParams {
  summary: string;
  body?: string;
  urgency?: "low" | "normal" | "critical";
  expireTime?: number;
  appName?: string;
  icon?: string;
  category?: string;
}

export function buildNotifySendArgs(params: NotifyToolParams): string[] {
  const args: string[] = [];

  if (params.urgency) args.push("-u", params.urgency);

  if (params.expireTime !== undefined)
    args.push("-t", String(params.expireTime));

  if (params.appName) args.push("-a", params.appName);

  if (params.icon) args.push("-i", params.icon);

  if (params.category) args.push("-c", params.category);

  args.push(params.summary);

  if (params.body) args.push(params.body);

  return args;
}
