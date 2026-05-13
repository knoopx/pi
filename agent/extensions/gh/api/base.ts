import { ghCmdJson } from "../../../shared/process/gh-cmd";

const STATE_FILTER = (
  state: "open" | "closed" | "merged" | "all" | undefined,
) => (state && state !== "all" ? `--state=${state}` : null);

export function buildListArgs<T extends string>(
  resource: T,
  owner: string,
  repo: string,
  state: "open" | "closed" | "merged" | "all" | undefined,
  limit: number,
  jsonFields: string,
): string[] {
  const args: string[] = [
    resource,
    "list",
    "-R",
    `${owner}/${repo}`,
    `--limit=${limit}`,
  ];
  const stateFilter = STATE_FILTER(state);
  if (stateFilter) args.push(stateFilter);
  args.push(`--json=${jsonFields}`, "--jq", "[.[] | . + {html_url: .url}]");
  return args;
}

export function buildViewArgs<T extends string>(
  resource: T,
  owner: string,
  repo: string,
  number: number,
  jsonFields: string,
): string[] {
  return [
    resource,
    "view",
    `${number}`,
    "-R",
    `${owner}/${repo}`,
    `--json=${jsonFields}`,
    "--jq",
    ". + {html_url: .url}",
  ];
}

export function listResource<R>(args: string[], label: string): Promise<R[]> {
  return ghCmdJson<R[]>(args, label);
}

export function viewResource<R>(args: string[], label: string): Promise<R> {
  return ghCmdJson<R>(args, label);
}
