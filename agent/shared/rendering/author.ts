export interface AuthorBadgeProps {
  name: string;
  fullname?: string;
  type?: string;
  isPro?: boolean;
  isHf?: boolean;
  isOrgMember?: boolean;
}

export function fmtAuthorBase(a: AuthorBadgeProps): string[] {
  const parts = [a.name];
  if (a.fullname && a.fullname !== a.name) parts.push(`(${a.fullname})`);
  const badges: string[] = [];
  if (a.type === "org") badges.push("org");
  if (a.isPro) badges.push("PRO");
  if (a.isHf) badges.push("HF staff");
  if (a.isOrgMember) badges.push("member");
  if (badges.length) parts.push(`[${badges.join(", ")}]`);
  return parts;
}
